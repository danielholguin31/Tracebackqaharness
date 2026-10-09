import { ToolboxContent } from '@/pages/Toolbox';
export function PersonalProjectToolbox({project}:{project:any}){return <><div className='v2-notice'>Resources are shared by the owner workspace. Project: {project.name}</div><ToolboxContent/></>;}
