import React from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from '../../../constants';
import Button from '../../ui/Button';

interface AIContentGeneratorProps {
  rawText: string;
  onRawTextChange: (text: string) => void;
  onGenerated: (descripcion: string, actividades: string[]) => void;
  onError: (error: string) => void;
  isGenerating: boolean;
  onStartGenerate: () => void;
}

export const AIContentGenerator: React.FC<AIContentGeneratorProps> = ({
  rawText,
  onRawTextChange,
  onGenerated,
  onError,
  isGenerating,
  onStartGenerate
}) => {
  const handleGenerate = async () => {
    if (!rawText.trim() || !GEMINI_API_KEY) {
      onError(!GEMINI_API_KEY ? "API key de Gemini no configurada" : "Por favor, pega el texto del convenio primero");
      return;
    }

    onStartGenerate();

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        Eres un asistente académico experto en el área de la Psicología.
        Tu tarea es procesar el siguiente texto crudo (convenio, programa, o descripción) para crear:

        1. Una descripción clara y atractiva (máximo 300 palabras)
        2. Una lista de actividades prácticas (entre 3 y 7 actividades)

        IMPORTANTE:
        - Solo responde en formato JSON válido, sin bloques de markdown
        - El JSON debe tener exactamente esta estructura:
          {
            "descripcion": "descripción completa",
            "actividades": ["Actividad 1", "Actividad 2", "Actividad 3"]
          }
        - La descripción debe mencionar objetivos y rol del practicante
        - Las actividades deben ser concretas y realistas
        - NO incluyas explicaciones fuera del JSON
        - NO redundancia: No menciones fechas, cantidad de cupos, ni horas acreditadas en la descripción (estos datos ya se muestran en otras partes de la tarjeta).
        - Si el texto no tiene suficiente información, crea contenido realista basado en el contexto

        Texto a procesar:
        """${rawText}"""
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        const cleanedText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleanedText);

        if (!parsed.descripcion || !parsed.actividades || !Array.isArray(parsed.actividades)) {
          throw new Error("Formato de respuesta inválido de la IA");
        }

        onGenerated(parsed.descripcion, parsed.actividades);
      } catch (parseError) {
        console.error("Error parsing AI response:", text);
        throw new Error("No se pudo procesar la respuesta de la IA");
      }
    } catch (error: any) {
      console.error("Error generating content:", error);
      onError(error.message || "Error al generar contenido con IA");
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
        Material de Referencia / Programa (Para IA)
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        * Pega el texto y haz click en "Generar". La IA completará la Descripción y Actividades. Luego usa "Previsualizar" para ver la tarjeta final.
      </p>
      <textarea
        value={rawText}
        onChange={(e) => onRawTextChange(e.target.value)}
        disabled={isGenerating}
        rows={4}
        placeholder="Pega aquí el texto del convenio, programa o descripción cruda. La IA lo usará para generar la tarjeta."
        className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:opacity-50 text-sm"
      />
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !rawText.trim()}
        icon="auto_awesome"
        className="w-full"
      >
        {isGenerating ? (
          <>
            <span className="animate-spin material-icons">refresh</span>
            Generando...
          </>
        ) : (
          <>
            <span className="material-icons">auto_awesome</span>
            Generar
          </>
        )}
      </Button>
    </div>
  );
};

export default AIContentGenerator;