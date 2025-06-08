interface Field {
    name: string
    type: 'string' | 'number' | 'boolean' | 'date' | 'enum'
    description?: string
    isOptional?: boolean
    options?: string[] // 用于enum类型
  }
  interface ToolDefinition {
    name: string
    description: string
    fields: Field[]
  }