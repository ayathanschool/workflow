/**
 * ====== AI-POWERED LESSON PLAN SUGGESTIONS ======
 * This file provides AI-generated suggestions using Google Gemini API
 * Think of this as your "AI Teaching Assistant"
 */

/**
 * Generate AI-powered lesson plan suggestions
 * @param {Object} context - Contains subject, class, chapter, session info
 * @returns {Object} - Suggested objectives, methods, resources, assessment
 */
function getAILessonSuggestions(context) {
  try {
    // Check if AI is enabled
    if (!AI_SUGGESTIONS_ENABLED || !GEMINI_API_KEY) {
      return {
        success: false,
        error: 'AI suggestions are not enabled. Please configure GEMINI_API_KEY in Config.gs'
      };
    }

    // Validate required context
    if (!context || !context.subject || !context.chapter) {
      return {
        success: false,
        error: 'Missing required information: subject and chapter are required'
      };
    }

    // Build the prompt for Gemini
    const prompt = _buildLessonPlanPrompt(context);
    
    // Call Gemini API
    const suggestions = _callGeminiAPI(prompt);
    
    if (!suggestions || !suggestions.success) {
      return {
        success: false,
        error: suggestions?.error || 'Failed to generate suggestions'
      };
    }

    Logger.log('[getAILessonSuggestions] Successfully generated suggestions');
    
    return {
      success: true,
      suggestions: suggestions.data
    };
    
  } catch (error) {
    Logger.log(`[getAILessonSuggestions] Error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Build a detailed prompt for Gemini API
 */
function _buildLessonPlanPrompt(context) {
  const className = context.class || '';
  const subject = context.subject || '';
  const chapter = context.chapter || '';
  const sessionNumber = context.session || 1;
  const totalSessions = context.totalSessions || '';
  
  return `You are an experienced educational consultant helping a teacher prepare a lesson plan.

Context:
- Class/Grade: ${className}
- Subject: ${subject}
- Chapter/Topic: ${chapter}
- Session Number: ${sessionNumber}${totalSessions ? ` of ${totalSessions}` : ''}

Please provide a detailed lesson plan with the following sections:

1. LEARNING OBJECTIVES (3-5 specific, measurable objectives):
   - What should students know or be able to do after this lesson?
   - Use action verbs (understand, explain, analyze, demonstrate, etc.)

2. TEACHING METHODS (2-3 effective pedagogical approaches):
   - How should this topic be taught?
   - Include both traditional and interactive methods
   - Consider different learning styles

3. RESOURCES REQUIRED (specific materials and tools):
   - What materials, equipment, or tools are needed?
   - Include both physical and digital resources
   - Be specific and practical

4. ASSESSMENT METHODS (2-3 ways to evaluate learning):
   - How will you check if students understood?
   - Include formative and summative assessment ideas
   - Make them practical and age-appropriate

Format your response as a JSON object with these exact keys:
{
  "learningObjectives": "...",
  "teachingMethods": "...",
  "resourcesRequired": "...",
  "assessmentMethods": "..."
}

Keep each section concise (2-4 sentences) but informative. Focus on practical, implementable suggestions.`;
}

/**
 * Call Google Gemini API
 */
function _callGeminiAPI(prompt) {
  try {
    // Use gemini-2.5-flash (stable, fast, 1M token context)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      Logger.log(`[Gemini API] Error ${responseCode}: ${responseText}`);
      return {
        success: false,
        error: `API returned status ${responseCode}. Check your API key and quota.`
      };
    }
    
    const result = JSON.parse(responseText);
    
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      return {
        success: false,
        error: 'Invalid response from Gemini API'
      };
    }
    
    const generatedText = result.candidates[0].content.parts[0].text;
    
    // Try to parse JSON from the response
    const parsedSuggestions = _parseGeminiResponse(generatedText);
    
    return {
      success: true,
      data: parsedSuggestions
    };
    
  } catch (error) {
    Logger.log(`[Gemini API] Exception: ${error.message}`);
    return {
      success: false,
      error: `API call failed: ${error.message}`
    };
  }
}

/**
 * Parse Gemini's response and extract JSON
 */
function _parseGeminiResponse(text) {
  try {
    // Remove markdown code blocks if present
    let cleanText = text.trim();
    cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Try to parse as JSON
    const parsed = JSON.parse(cleanText);
    
    return {
      learningObjectives: parsed.learningObjectives || '',
      teachingMethods: parsed.teachingMethods || '',
      resourcesRequired: parsed.resourcesRequired || '',
      assessmentMethods: parsed.assessmentMethods || ''
    };
    
  } catch (parseError) {
    // If JSON parsing fails, try to extract sections manually
    Logger.log('[parseGeminiResponse] JSON parse failed, extracting manually');
    
    return {
      learningObjectives: _extractSection(text, 'learningObjectives') || _extractSection(text, 'LEARNING OBJECTIVES') || 'AI-generated objectives (format error)',
      teachingMethods: _extractSection(text, 'teachingMethods') || _extractSection(text, 'TEACHING METHODS') || 'AI-generated methods (format error)',
      resourcesRequired: _extractSection(text, 'resourcesRequired') || _extractSection(text, 'RESOURCES REQUIRED') || 'AI-generated resources (format error)',
      assessmentMethods: _extractSection(text, 'assessmentMethods') || _extractSection(text, 'ASSESSMENT METHODS') || 'AI-generated assessment (format error)'
    };
  }
}

/**
 * Extract a section from text (fallback method)
 */
function _extractSection(text, sectionName) {
  try {
    const pattern = new RegExp(`"?${sectionName}"?\\s*[:=]\\s*"?([^"]+)"?`, 'i');
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  } catch (e) {
    return null;
  }
}
