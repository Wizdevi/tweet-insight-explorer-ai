
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Twitter, Download, Link, User, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const TwitterExtractor = ({ onDataExtracted, onLog }) => {
  const [urlsText, setUrlsText] = useState('');
  const [extractionType, setExtractionType] = useState('tweets');
  const [tweetCount, setTweetCount] = useState(10);
  const [extractedData, setExtractedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const parseTwitterUrl = (url) => {
    console.log('Парсинг URL:', url);
    
    // Удаляем параметры и якоря
    const cleanUrl = url.split('?')[0].split('#')[0];
    
    // Поддерживаем разные форматы Twitter URL
    const tweetMatch = cleanUrl.match(/(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/);
    const userMatch = cleanUrl.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)(?:\/)?$/);
    
    if (tweetMatch) {
      console.log('Найден твит ID:', tweetMatch[1]);
      return { type: 'tweet', id: tweetMatch[1] };
    } else if (userMatch && userMatch[1] !== 'status') {
      console.log('Найден пользователь:', userMatch[1]);
      return { type: 'user', username: userMatch[1] };
    }
    
    console.log('URL не распознан');
    return null;
  };

  const makeApiRequest = async (url, apiKey) => {
    console.log('Выполняю запрос к:', url);
    
    try {
      // Попытка прямого запроса
      const response = await fetch(url, {
        method: 'GET',
        headers: { 
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors'
      });
      
      console.log('Статус ответа:', response.status);
      console.log('Headers ответа:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Текст ошибки:', errorText);
        
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('Данные получены:', data);
      return data;
      
    } catch (error) {
      console.error('Ошибка запроса:', error);
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('CORS ошибка: API недоступен из браузера. Возможные причины:\n1. API блокирует запросы из браузера\n2. Неверный API ключ\n3. Превышен лимит запросов');
      }
      
      throw error;
    }
  };

  const extractData = async () => {
    const apiKey = localStorage.getItem('twitterApiKey');
    if (!apiKey) {
      toast({
        title: "Ошибка",
        description: "Необходимо указать Twitter API ключ в настройках",
        variant: "destructive"
      });
      onLog('Отсутствует Twitter API ключ', 'error');
      return;
    }

    const urls = urlsText.split('\n').filter(url => url.trim());
    if (urls.length === 0) {
      toast({
        title: "Ошибка",
        description: "Введите хотя бы одну ссылку",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    onLog(`Начало извлечения данных. Тип: ${extractionType}, URLs: ${urls.length}`, 'info');
    onLog(`Используемый API ключ: ${apiKey.substring(0, 8)}...`, 'info');
    
    try {
      const results = [];

      for (const url of urls) {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) continue;

        console.log('Обработка URL:', trimmedUrl);
        const parsed = parseTwitterUrl(trimmedUrl);
        
        if (!parsed) {
          onLog(`Неверный формат URL: ${trimmedUrl}`, 'error');
          continue;
        }

        onLog(`Обработка ${parsed.type}: ${trimmedUrl}`, 'info');

        try {
          if (extractionType === 'tweets' && parsed.type === 'tweet') {
            // Извлечение отдельного твита
            console.log('Запрос твита с ID:', parsed.id);
            
            const apiUrl = `https://api.twitterapi.io/twitter/tweet/lookup?tweetId=${parsed.id}`;
            onLog(`Запрос к API: ${apiUrl}`, 'info');
            
            const tweetData = await makeApiRequest(apiUrl, apiKey);
            
            // Получаем информацию о профиле автора если есть username
            let authorInfo = null;
            const authorUsername = tweetData.author?.username || tweetData.user?.screen_name;
            
            if (authorUsername) {
              try {
                const userApiUrl = `https://api.twitterapi.io/twitter/user/info?userName=${authorUsername}`;
                onLog(`Запрос информации об авторе: ${userApiUrl}`, 'info');
                authorInfo = await makeApiRequest(userApiUrl, apiKey);
                console.log('Информация об авторе получена:', authorInfo);
              } catch (error) {
                console.log('Ошибка получения информации об авторе:', error);
                onLog(`Не удалось получить информацию об авторе: ${error.message}`, 'warning');
              }
            }

            results.push({
              type: 'single_tweet',
              originalUrl: trimmedUrl,
              tweetUrl: `https://twitter.com/${authorUsername}/status/${parsed.id}`,
              tweetData: {
                id: parsed.id,
                text: tweetData.text || tweetData.full_text || 'Текст недоступен',
                created_at: tweetData.created_at,
                like_count: tweetData.favorite_count || tweetData.like_count || 0,
                retweet_count: tweetData.retweet_count || 0,
                reply_count: tweetData.reply_count || 0,
                view_count: tweetData.view_count || 0
              },
              authorProfile: authorInfo
            });
            
            onLog(`Успешно извлечен твит ${parsed.id}`, 'success');

          } else if (extractionType === 'accounts' && parsed.type === 'user') {
            // Получение информации о пользователе
            console.log('Запрос пользователя:', parsed.username);
            
            const userApiUrl = `https://api.twitterapi.io/twitter/user/info?userName=${parsed.username}`;
            onLog(`Запрос к API: ${userApiUrl}`, 'info');
            
            const userData = await makeApiRequest(userApiUrl, apiKey);

            // Получение последних твитов
            const tweetsApiUrl = `https://api.twitterapi.io/twitter/user/last_tweets?userName=${parsed.username}`;
            onLog(`Запрос твитов пользователя: ${tweetsApiUrl}`, 'info');

            let tweetsData = { tweets: [] };
            try {
              tweetsData = await makeApiRequest(tweetsApiUrl, apiKey);
              console.log('Твиты пользователя получены:', tweetsData);
            } catch (error) {
              onLog(`Не удалось получить твиты пользователя: ${error.message}`, 'warning');
            }
            
            // Ограничиваем количество твитов и добавляем ссылки
            const tweets = (tweetsData.tweets || []).slice(0, tweetCount).map((tweet, index) => ({
              id: tweet.id || `tweet_${index}`,
              text: tweet.text || tweet.full_text || 'Текст недоступен',
              created_at: tweet.created_at,
              like_count: tweet.favorite_count || tweet.like_count || 0,
              retweet_count: tweet.retweet_count || 0,
              reply_count: tweet.reply_count || 0,
              view_count: tweet.view_count || 0,
              tweetUrl: tweet.id ? `https://twitter.com/${parsed.username}/status/${tweet.id}` : null
            }));

            results.push({
              type: 'user_tweets',
              originalUrl: trimmedUrl,
              profileUrl: `https://twitter.com/${parsed.username}`,
              userProfile: {
                username: userData.username || parsed.username,
                name: userData.name || userData.display_name || '',
                description: userData.description || userData.bio || '',
                followers_count: userData.followers_count || userData.followers || 0,
                following_count: userData.following_count || userData.following || 0,
                tweet_count: userData.statuses_count || userData.tweet_count || 0,
                verified: userData.verified || false,
                location: userData.location || '',
                profile_image_url: userData.profile_image_url || ''
              },
              tweets: tweets,
              totalTweets: tweets.length
            });
            
            onLog(`Успешно извлечено ${tweets.length} твитов от @${parsed.username}`, 'success');
          } else {
            onLog(`Несоответствие типа извлечения "${extractionType}" и типа URL "${parsed.type}": ${trimmedUrl}`, 'error');
          }
        } catch (error) {
          console.error('Ошибка при обработке URL:', error);
          onLog(`Ошибка при обработке ${trimmedUrl}: ${error.message}`, 'error');
        }
      }

      const finalData = {
        extractedAt: new Date().toISOString(),
        extractionType: extractionType,
        totalResults: results.length,
        results: results
      };

      console.log('Финальные данные:', finalData);
      setExtractedData(finalData);
      onDataExtracted(finalData);
      
      if (results.length > 0) {
        onLog(`Успешно завершено извлечение: ${results.length} записей`, 'success');
        toast({
          title: "Успех",
          description: `Извлечено ${results.length} записей из ${urls.length} URL`
        });
      } else {
        onLog('Не удалось извлечь ни одной записи', 'warning');
        toast({
          title: "Предупреждение",
          description: "Не удалось извлечь данные из предоставленных URL",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Общая ошибка извлечения:', error);
      onLog(`Критическая ошибка извлечения: ${error.message}`, 'error');
      toast({
        title: "Ошибка",
        description: "Произошла критическая ошибка при извлечении данных",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadJson = () => {
    if (!extractedData) return;

    const dataStr = JSON.stringify(extractedData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `twitter_data_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    onLog('JSON файл успешно скачан', 'success');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Twitter className="w-5 h-5 text-blue-500" />
            Извлечение Twitter данных
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Предупреждение о CORS */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Важно:</strong> Если возникают ошибки "Failed to fetch", это связано с CORS политикой браузера. 
              Убедитесь, что ваш API ключ действителен и поддерживает запросы из браузера.
            </AlertDescription>
          </Alert>

          <div>
            <Label className="text-sm font-medium">Тип извлечения</Label>
            <Select value={extractionType} onValueChange={setExtractionType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tweets">
                  <div className="flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    Отдельные твиты
                  </div>
                </SelectItem>
                <SelectItem value="accounts">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Аккаунты пользователей
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">
              {extractionType === 'tweets' ? 'Ссылки на твиты' : 'Ссылки на аккаунты'}
            </Label>
            <Textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={extractionType === 'tweets' 
                ? "Введите ссылки на твиты, каждая с новой строки:\nhttps://twitter.com/username/status/123456\nhttps://x.com/username/status/789012"
                : "Введите ссылки на аккаунты, каждая с новой строки:\nhttps://twitter.com/username1\nhttps://x.com/username2"
              }
              className="mt-1 min-h-[120px]"
            />
          </div>

          {extractionType === 'accounts' && (
            <div>
              <Label htmlFor="tweetCount">Количество твитов с каждого аккаунта</Label>
              <Input
                id="tweetCount"
                type="number"
                value={tweetCount}
                onChange={(e) => setTweetCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
                min="1"
                max="100"
                className="mt-1"
              />
            </div>
          )}

          <Button 
            onClick={extractData} 
            disabled={isLoading || !urlsText.trim()}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? 'Извлечение...' : 'Извлечь данные'}
          </Button>
        </CardContent>
      </Card>

      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Извлеченные данные</span>
              <Badge variant="secondary">
                {extractedData.totalResults} записей
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Предварительный просмотр:</p>
                <div className="space-y-2">
                  {extractedData.results.slice(0, 3).map((result, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">{result.originalUrl}</span>
                      <Badge variant="outline">
                        {result.type === 'single_tweet' ? 'Твит' : 'Профиль'}
                      </Badge>
                    </div>
                  ))}
                  {extractedData.results.length > 3 && (
                    <p className="text-sm text-gray-500">
                      И еще {extractedData.results.length - 3} записей...
                    </p>
                  )}
                </div>
              </div>
              
              <Button 
                onClick={downloadJson} 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Скачать JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TwitterExtractor;
