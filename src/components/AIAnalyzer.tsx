
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Brain, Save, Play, FileText } from 'lucide-react';

const AIAnalyzer = ({ extractedData, onLog }) => {
  const [prompts, setPrompts] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const availableModels = [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (быстрый)' },
    { value: 'gpt-4o', label: 'GPT-4o (мощный)' },
    { value: 'gpt-4.5-preview', label: 'GPT-4.5 Preview (премиум)' }
  ];

  const defaultPrompts = [
    {
      name: 'Анализ настроения',
      content: 'Проанализируй настроение и тональность следующих твитов. Определи общую эмоциональную окраску, основные темы и настроения автора.'
    },
    {
      name: 'Извлечение ключевых тем',
      content: 'Извлеки основные темы и ключевые слова из предоставленных твитов. Сгруппируй контент по тематикам и определи наиболее обсуждаемые темы.'
    },
    {
      name: 'Анализ вовлеченности',
      content: 'Проанализируй уровень вовлеченности аудитории по метрикам лайков, ретвитов и просмотров. Определи наиболее успешные типы контента.'
    }
  ];

  useEffect(() => {
    const savedPrompts = localStorage.getItem('aiPrompts');
    if (savedPrompts) {
      setPrompts(JSON.parse(savedPrompts));
    } else {
      setPrompts(defaultPrompts);
      localStorage.setItem('aiPrompts', JSON.stringify(defaultPrompts));
    }
  }, []);

  const savePrompt = () => {
    if (!currentPrompt.trim()) return;

    const promptName = prompt('Введите название для сохранения промпта:');
    if (!promptName) return;

    const newPrompt = {
      name: promptName,
      content: currentPrompt
    };

    const updatedPrompts = [...prompts, newPrompt];
    setPrompts(updatedPrompts);
    localStorage.setItem('aiPrompts', JSON.stringify(updatedPrompts));
    
    toast({
      title: "Промпт сохранен",
      description: `Промпт "${promptName}" добавлен в коллекцию`
    });
    onLog(`Сохранен новый промпт: ${promptName}`, 'info');
  };

  const loadPrompt = (prompt) => {
    setCurrentPrompt(prompt.content);
  };

  const prepareDataForAnalysis = () => {
    if (!extractedData) return '';

    let dataText = '';
    
    extractedData.results.forEach((result, index) => {
      if (result.type === 'single_tweet') {
        dataText += `\nТвит ${index + 1}:\n`;
        dataText += `URL: ${result.tweetUrl}\n`;
        dataText += `Текст: ${result.data.text}\n`;
        dataText += `Автор: ${result.data.author?.username || 'Неизвестно'}\n`;
        dataText += `Лайки: ${result.data.likeCount || 0}\n`;
        dataText += `Ретвиты: ${result.data.retweetCount || 0}\n`;
        dataText += `Дата: ${result.data.created_at}\n`;
        
        if (result.authorProfile) {
          dataText += `Профиль автора:\n`;
          dataText += `  Описание: ${result.authorProfile.description || 'Нет описания'}\n`;
          dataText += `  Подписчики: ${result.authorProfile.followers || 0}\n`;
          dataText += `  Местоположение: ${result.authorProfile.location || 'Не указано'}\n`;
        }
      } else if (result.type === 'user_tweets') {
        dataText += `\nПрофиль: ${result.userInfo?.username || 'Неизвестно'}\n`;
        dataText += `URL профиля: ${result.url}\n`;
        dataText += `Описание: ${result.userInfo?.description || 'Нет описания'}\n`;
        dataText += `Подписчики: ${result.userInfo?.followers || 0}\n`;
        dataText += `Местоположение: ${result.userInfo?.location || 'Не указано'}\n\n`;
        dataText += `Твиты пользователя:\n`;
        result.tweets.forEach((tweet, tweetIndex) => {
          dataText += `${tweetIndex + 1}. URL: ${tweet.tweetUrl}\n`;
          dataText += `   Текст: ${tweet.text}\n`;
          dataText += `   Просмотры: ${tweet.viewCount || 0}\n`;
          dataText += `   Дата: ${tweet.created_at}\n\n`;
        });
      }
    });

    return dataText;
  };

  const analyzeWithAI = async () => {
    const apiKey = localStorage.getItem('openaiApiKey');
    if (!apiKey) {
      toast({
        title: "Ошибка",
        description: "Необходимо указать OpenAI API ключ в настройках",
        variant: "destructive"
      });
      return;
    }

    if (!extractedData) {
      toast({
        title: "Ошибка",
        description: "Нет данных для анализа. Сначала извлеките данные Twitter.",
        variant: "destructive"
      });
      return;
    }

    if (!currentPrompt.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите промпт для анализа",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    onLog('Начало AI анализа', 'info');

    try {
      const dataForAnalysis = prepareDataForAnalysis();
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: 'Ты эксперт по анализу социальных медиа и Twitter данных. Предоставляй подробные и структурированные анализы.'
            },
            {
              role: 'user',
              content: `${currentPrompt}\n\nДанные для анализа:\n${dataForAnalysis}`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API ошибка: ${response.status}`);
      }

      const result = await response.json();
      const analysisResult = result.choices[0]?.message?.content || 'Не удалось получить анализ';
      
      setAnalysis(analysisResult);
      onLog('AI анализ завершен успешно', 'success');
      
      toast({
        title: "Анализ завершен",
        description: "AI анализ данных выполнен успешно"
      });

    } catch (error) {
      onLog(`Ошибка AI анализа: ${error.message}`, 'error');
      toast({
        title: "Ошибка анализа",
        description: "Произошла ошибка при выполнении AI анализа",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            AI Анализ данных
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!extractedData && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Сначала извлеките данные Twitter для анализа</p>
            </div>
          )}

          {extractedData && (
            <>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700 mb-1">Доступны данные для анализа:</p>
                <Badge variant="secondary">
                  {extractedData.totalResults} записей извлечено
                </Badge>
              </div>

              <div>
                <Label className="text-sm font-medium">Выберите модель AI</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Сохраненные промпты</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {prompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => loadPrompt(prompt)}
                      className="bg-indigo-100 hover:bg-indigo-200 border-indigo-300"
                    >
                      {prompt.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="prompt">Промпт для анализа</Label>
                <Textarea
                  id="prompt"
                  value={currentPrompt}
                  onChange={(e) => setCurrentPrompt(e.target.value)}
                  placeholder="Введите ваш промпт для анализа данных..."
                  className="mt-1 min-h-[100px]"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={savePrompt}
                    disabled={!currentPrompt.trim()}
                    className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить промпт
                  </Button>
                </div>
              </div>

              <Button 
                onClick={analyzeWithAI} 
                disabled={isAnalyzing || !currentPrompt.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Play className="w-4 h-4 mr-2" />
                {isAnalyzing ? 'Анализирую...' : 'Запустить анализ'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Результат анализа</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm">{analysis}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIAnalyzer;
