import './init'
import { createTool } from './base'
import personal_thought from './personal_thought.json'
import interview_host from './interview_host.json'

const personal_thought_tool = createTool(
  personal_thought as unknown as ToolDefinition
)
const interview_host_tool = createTool(
  interview_host as unknown as ToolDefinition
)

export const tools: any = [
  ...Object.values(personal_thought_tool),
  ...Object.values(interview_host_tool)
]
