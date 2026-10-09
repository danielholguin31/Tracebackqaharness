import { db,schema } from '../db';
import { uid,now } from './helpers';
import { selectedViewports } from './runner';
export async function createRuns(test:typeof schema.tests.$inferSelect,options:{environment?:string;triggeredBy?:string;viewport?:string;suiteRunId?:string}={}){
 const viewports=options.viewport?[options.viewport]:selectedViewports(test.viewportJson);
 if(viewports.some(v=>!['desktop','tablet','mobile'].includes(v)))throw new Error('Invalid viewport');
 const result:typeof schema.runs.$inferSelect[]=[];
 await db.transaction(async tx=>{
  for(const viewport of viewports){
   const value={id:uid(),workspaceId:test.workspaceId,projectId:test.projectId,testId:test.id,testName:test.name,mode:test.mode,status:'queued',environment:options.environment||test.environment,viewport,runnerMode:test.runnerMode,triggeredBy:options.triggeredBy||'manual',startedAt:now(),suiteRunId:options.suiteRunId||null};
   const [run]=await tx.insert(schema.runs).values(value).returning();result.push(run);
   if(options.suiteRunId)await tx.insert(schema.suiteRunResults).values({id:uid(),suiteRunId:options.suiteRunId,testId:test.id,testName:`${test.name} · ${viewport}`,runId:run.id,status:'running',issueCount:0});
  }
 });return result;
}
