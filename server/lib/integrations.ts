import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { now } from './helpers';
export async function pushIssue(id: string, target: string) {
 const [issue]=await db.select().from(schema.issues).where(eq(schema.issues.id,id));
 if(!issue)throw new Error('Issue not found');
 if(issue.externalRefJson)return JSON.parse(issue.externalRefJson);
 const body=`${issue.evidence}\n\nEnvironment: ${issue.context}\nRun: ${issue.runId}\n\n${issue.proposedSolution||''}`;
 let externalRef:{type:string,id:string,url:string};
 if(target==='github'){
  if(!process.env.GITHUB_TOKEN||!process.env.GITHUB_REPOSITORY)throw new Error('Configure GITHUB_TOKEN and GITHUB_REPOSITORY to create GitHub issues');
  const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues`,{method:'POST',headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'Content-Type':'application/json',Accept:'application/vnd.github+json'},body:JSON.stringify({title:issue.title,body}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error(`GitHub issue creation failed (${r.status})`);const result:any=await r.json();externalRef={type:target,id:String(result.number),url:result.html_url};
 }else if(target==='linear'){
  if(!process.env.LINEAR_API_KEY||!process.env.LINEAR_TEAM_ID)throw new Error('Configure LINEAR_API_KEY and LINEAR_TEAM_ID to create Linear issues');
  const r=await fetch('https://api.linear.app/graphql',{method:'POST',headers:{Authorization:process.env.LINEAR_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({query:'mutation($input: IssueCreateInput!){issueCreate(input:$input){success issue{id identifier url}}}',variables:{input:{teamId:process.env.LINEAR_TEAM_ID,title:issue.title,description:body}}}),signal:AbortSignal.timeout(15000)});
  const result:any=await r.json();const created=result.data?.issueCreate;if(!r.ok||!created?.success)throw new Error('Linear issue creation failed');externalRef={type:target,id:created.issue.identifier,url:created.issue.url};
 }else throw new Error('This ticket integration is unavailable. Use GitHub or Linear.');
 await db.update(schema.issues).set({status:'pushed',pushedAt:now(),externalRefJson:JSON.stringify(externalRef)}).where(eq(schema.issues.id,id));
 return externalRef;
}
