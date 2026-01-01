import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, FileSystem, FileNode } from '../types';

export const getAIResponse = async (
  apiKey: string,
  modelName: string,
  history: ChatMessage[],
  fullFsContext: FileSystem,
  taggedFiles: FileNode[]
) => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Project structure overview
    const projectMap = Object.values(fullFsContext)
      .map(node => {
        const path = node.name;
        return `${node.type.toUpperCase()}: ${path} (ID: ${node.id})`;
      })
      .join('\n');

    // Explicitly provided context contents
    const explicitContext = taggedFiles.length > 0 
      ? "\nEXPLICIT FILE CONTEXTS:\n" + taggedFiles.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}\n---`).join('\n')
      : "";

    const systemInstruction = `You are the WindSurf Architect Agent. You are a world-class senior full-stack engineer with deep expertise in web technologies.

WORKSPACE STRUCTURE:
${projectMap}
${explicitContext}

MISSION:
Transform the user's request into a technical plan and production-grade file operations.

RESPONSE FORMAT:
You MUST respond with a single JSON object matching this schema:
{
  "reasoning": "Technical explanation of the solution. Mention any files you propose to link or create.",
  "operations": [
    {
      "path": "filename.extension",
      "content": "THE ENTIRE SOURCE CODE FOR THE FILE",
      "action": "create" or "update"
    }
  ]
}

RULES:
1. ALWAYS provide the FULL source code of any file you create or update.
2. If the user tags files with '@', use that specific context for your logic.
3. If proposing a new file, include it in the 'operations' array.
4. Return raw JSON text only.
`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      })),
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reasoning: { type: Type.STRING },
            operations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  path: { type: Type.STRING },
                  content: { type: Type.STRING },
                  action: { type: Type.STRING, enum: ['create', 'update'] }
                },
                required: ['path', 'content', 'action']
              }
            }
          },
          required: ['reasoning', 'operations']
        }
      }
    });

    const text = response.text || '{}';
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse AI response:", text);
      return { reasoning: text, operations: [] };
    }
  } catch (error: any) {
    console.error("Architect Engine Error:", error);
    if (error?.message?.includes("Requested entity was not found") || error?.status === 403 || error?.status === 400) {
        throw new Error("KEY_ERROR");
    }
    throw error;
  }
};