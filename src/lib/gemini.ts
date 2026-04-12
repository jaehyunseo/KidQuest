import { GoogleGenAI } from '@google/genai';

export async function generateEncouragementText(completedQuestTitles: string[]): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not defined');
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const completedQuests = completedQuestTitles.join(', ');
    const prompt = `당신은 아이들을 격려하는 다정한 선생님입니다. 아이가 오늘 완료한 일들(${completedQuests || '아직 없지만 시작하려는 중'})을 보고 아이에게 칭찬과 응원의 메시지를 한 문장으로 아주 재미있고 따뜻하게 해주세요. 이모티콘도 섞어서요.`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
    });
    return response.text || '오늘도 멋진 하루를 만들어보자!';
  } catch (error: any) {
    console.error('AI Error:', error);
    if (error.response) {
      console.error('AI Error Response:', error.response);
    }
    return '오늘도 너의 도전을 응원해! 화이팅! 🌟';
  }
}
