import { createTool } from './base'
import personal_thought from './personal_thought.json'


const personal_thought_tool = createTool(personal_thought as unknown as ToolDefinition)

export const tools: any = [personal_thought_tool.query,personal_thought_tool.record]
