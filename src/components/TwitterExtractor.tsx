
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Twitter, Download, Link, User, AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const TwitterExtractor = ({ onDataExtracted, onLog }) => {
  const [urlsText, setUrlsText] = useState('');
  const [extractionType, setExtractionType] = useState('tweets');
  const [tweetCount, setTweetCount] = useState(10);
  const [withReplies, setWithReplies] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [runId, setRunId] = useState(null);
  const { toast } = useToast();

  const parseTwitterUrl = (url) => {
    console.log('Парсинг URL:', url);
    
    const cleanUrl = url.split('?')[0].split('#')[0];
    
    // Поддерживаем разные форматы Twitter URL
    const tweetMatch = cleanUrl.match(/(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/);
    const userMatch = cleanUrl.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)(?:\/)?$/);
    
    if (tweetMatch) {
      console.log('Найден твит ID:', tweetMatch[1]);
      return { type: 'tweet', id: tweetMatch[1], url: cleanUrl };
    } else if (userMatch && userMatch[1] !== 'status') {
      console.log('Найден пользователь:', userMatch[1]);
      return { type: 'user', username: userMatch[1], url: cleanUrl };
    }
    
    console.log('URL не распознан');
    return null;
  };

  const startApifyActor = async (inputData, apiToken) => {
    console.log('Запуск Apify Actor с данными:', inputData);
    
    const response = await fetch('https://api.apify.com/v2/acts/web.harvester~twitter-scraper/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify(inputData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Ошибка запуска Actor:', errorText);
      throw new Error(`Ошибка запуска Actor: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('Actor запущен:', result);
    return result.data.id;
  };

  const checkRunStatus = async (runId, apiToken) => {
    const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Ошибка получения статуса: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  };

  const getRunResults = async (runId, apiToken) => {
    const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Ошибка получения результатов: ${response.status}`);
    }

    const results = await response.json();
    return results;
  };

  const waitForCompletion = async (runId, apiToken, maxWaitTime = 300000) => {
    const startTime = Date.now();
    const checkInterval = 5000; // 5 секунд
    
    while (Date.now() - startTime < maxWaitTime) {
      const runInfo = await checkRunStatus(runId, apiToken);
      console.log('Статус выполнения:', runInfo.status);
      
      onLog(`Статус выполнения: ${runInfo.status}`, 'info');
      
      if (runInfo.status === 'SUCCEEDED') {
        return await getRunResults(runId, apiToken);
      } else if (runInfo.status === 'FAILED') {
        throw new Error('Выполнение Actor завершилось с ошибкой');
      } else if (runInfo.status === 'ABORTED') {
        throw new Error('Выполнение Actor было прервано');
      }
      
      // Ждем перед следующей проверкой
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error('Превышено время ожидания выполнения');
  };

  const extractData = async () => {
    const apiToken = localStorage.getItem('apifyApiToken');
    if (!apiToken) {
      toast({
        title: "Ошибка",
        description: "Необходимо указать Apify API токен в настройках",
        variant: "destructive"
      });
      onLog('Отсутствует Apify API токен', 'error');
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
    
    try {
      const startUrls = [];
      const handles = [];

      // Обрабатываем URLs и разделяем на прямые ссылки и handles
      for (const url of urls) {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) continue;

        const parsed = parseTwitterUrl(trimmedUrl);
        
        if (!parsed) {
          onLog(`Неверный формат URL: ${trimmedUrl}`, 'error');
          continue;
        }

        if (parsed.type === 'user') {
          if (extractionType === 'accounts') {
            startUrls.push(parsed.url);
            handles.push(parsed.username);
          } else {
            onLog(`URL аккаунта не подходит для извлечения твитов: ${trimmedUrl}`, 'warning');
          }
        } else if (parsed.type === 'tweet') {
          if (extractionType === 'tweets') {
            startUrls.push(parsed.url);
          } else {
            onLog(`URL твита не подходит для извлечения аккаунтов: ${trimmedUrl}`, 'warning');
          }
        }
      }

      if (startUrls.length === 0) {
        toast({
          title: "Ошибка",
          description: "Нет подходящих URL для обработки",
          variant: "destructive"
        });
        return;
      }

      // Формируем данные для Apify Actor
      const inputData = {
        startUrls: startUrls,
        handles: handles,
        tweetsDesired: extractionType === 'accounts' ? tweetCount : 1,
        withReplies: withReplies,
        includeUserInfo: true
      };

      onLog(`Подготовка запроса к Apify с параметрами: ${JSON.stringify(inputData, null, 2)}`, 'info');

      // Запускаем Actor
      const currentRunId = await startApifyActor(inputData, apiToken);
      setRunId(currentRunId);
      
      onLog(`Actor запущен с ID: ${currentRunId}`, 'success');
      toast({
        title: "Запуск успешен",
        description: `Actor запущен. ID выполнения: ${currentRunId}`,
      });

      // Ждем завершения и получаем результаты
      onLog('Ожидание завершения извлечения данных...', 'info');
      const results = await waitForCompletion(currentRunId, apiToken);
      
      console.log('Получены результаты:', results);

      // Обрабатываем результаты
      const processedResults = [];
      
      for (const item of results) {
        if (extractionType === 'accounts') {
          // Группируем по пользователям
          const existingUser = processedResults.find(r => r.userProfile?.userId === item.user?.userId);
          
          if (existingUser) {
            existingUser.tweets.push({
              id: item.id,
              text: item.text,
              created_at: item.timestamp,
              like_count: item.likes || 0,
              retweet_count: item.retweets || 0,
              reply_count: item.replies || 0,
              quote_count: item.quotes || 0,
              view_count: item.views || 0,
              tweetUrl: item.url,
              isPinned: item.isPinned || false,
              isQuote: item.isQuote || false,
              isRetweet: item.isRetweet || false,
              isReply: item.isReply || false,
              media: item.media || []
            });
          } else {
            processedResults.push({
              type: 'user_tweets',
              originalUrl: item.user?.url || `https://x.com/${item.user?.username}`,
              profileUrl: item.user?.url || `https://x.com/${item.user?.username}`,
              userProfile: {
                userId: item.user?.userId,
                username: item.user?.username || item.username,
                name: item.user?.userFullName || item.fullname,
                description: item.user?.description || '',
                followers_count: item.user?.totalFollowers || 0,
                following_count: item.user?.totalFollowing || 0,
                tweet_count: item.user?.totalTweets || 0,
                verified: item.user?.verified || item.verified || false,
                location: item.user?.location || '',
                profile_image_url: item.user?.avatar || '',
                website: item.user?.website || '',
                joinDate: item.user?.joinDate || '',
                totalLikes: item.user?.totalLikes || 0,
                totalMediaCount: item.user?.totalMediaCount || 0
              },
              tweets: [{
                id: item.id,
                text: item.text,
                created_at: item.timestamp,
                like_count: item.likes || 0,
                retweet_count: item.retweets || 0,
                reply_count: item.replies || 0,
                quote_count: item.quotes || 0,
                view_count: item.views || 0,
                tweetUrl: item.url,
                isPinned: item.isPinned || false,
                isQuote: item.isQuote || false,
                isRetweet: item.isRetweet || false,
                isReply: item.isReply || false,
                media: item.media || []
              }],
              totalTweets: 1
            });
          }
        } else {
          // Отдельные твиты
          processedResults.push({
            type: 'single_tweet',
            originalUrl: item.url,
            tweetUrl: item.url,
            tweetData: {
              id: item.id,
              text: item.text,
              created_at: item.timestamp,
              like_count: item.likes || 0,
              retweet_count: item.retweets || 0,
              reply_count: item.replies || 0,
              quote_count: item.quotes || 0,
              view_count: item.views || 0,
              isPinned: item.isPinned || false,
              isQuote: item.isQuote || false,
              isRetweet: item.isRetweet || false,
              isReply: item.isReply || false,
              media: item.media || []
            },
            authorProfile: item.user ? {
              userId: item.user.userId,
              username: item.user.username || item.username,
              name: item.user.userFullName || item.fullname,
              description: item.user.description || '',
              followers_count: item.user.totalFollowers || 0,
              following_count: item.user.totalFollowing || 0,
              tweet_count: item.user.totalTweets || 0,
              verified: item.user.verified || item.verified || false,
              location: item.user.location || '',
              profile_image_url: item.user.avatar || '',
              website: item.user.website || '',
              joinDate: item.user.joinDate || '',
              totalLikes: item.user.totalLikes || 0,
              totalMediaCount: item.user.totalMediaCount || 0
            } : null
          });
        }
      }

      const finalData = {
        extractedAt: new Date().toISOString(),
        extractionType: extractionType,
        totalResults: processedResults.length,
        apifyRunId: currentRunId,
        results: processedResults
      };

      console.log('Финальные данные:', finalData);
      setExtractedData(finalData);
      onDataExtracted(finalData);
      
      if (processedResults.length > 0) {
        onLog(`Успешно завершено извлечение: ${processedResults.length} записей`, 'success');
        toast({
          title: "Успех",
          description: `Извлечено ${processedResults.length} записей из ${urls.length} URL`
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
      console.error('Ошибка извлечения:', error);
      onLog(`Ошибка извлечения: ${error.message}`, 'error');
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setRunId(null);
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
            Извлечение Twitter данных (Apify)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Новый сервис:</strong> Теперь используется Apify Twitter Scraper. 
              Убедитесь, что у вас есть действительный Apify API токен в настройках.
              Процесс извлечения может занять несколько минут.
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
            <>
              <div>
                <Label htmlFor="tweetCount">Количество твитов с каждого аккаунта</Label>
                <Input
                  id="tweetCount"
                  type="number"
                  value={tweetCount}
                  onChange={(e) => setTweetCount(Math.max(1, Math.min(200, parseInt(e.target.value) || 10)))}
                  min="1"
                  max="200"
                  className="mt-1"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="withReplies"
                  checked={withReplies}
                  onChange={(e) => setWithReplies(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="withReplies" className="text-sm">
                  Включать ответы в треды
                </Label>
              </div>
            </>
          )}

          <Button 
            onClick={extractData} 
            disabled={isLoading || !urlsText.trim()}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                Извлечение... {runId && `(ID: ${runId.substring(0, 8)}...)`}
              </div>
            ) : (
              'Извлечь данные'
            )}
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
                  {extractedData.apifyRunId && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>Apify Run ID: {extractedData.apifyRunId}</span>
                    </div>
                  )}
                  {extractedData.results.slice(0, 3).map((result, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">{result.originalUrl || result.profileUrl}</span>
                      <Badge variant="outline">
                        {result.type === 'single_tweet' ? 'Твит' : 'Профиль'}
                      </Badge>
                      {result.tweets && (
                        <Badge variant="outline" className="text-xs">
                          {result.tweets.length} твитов
                        </Badge>
                      )}
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
