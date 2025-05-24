
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Twitter, Download, Link, User } from 'lucide-react';

const TwitterExtractor = ({ onDataExtracted, onLog }) => {
  const [urlsText, setUrlsText] = useState('');
  const [extractionType, setExtractionType] = useState('tweets'); // 'tweets' or 'accounts'
  const [tweetCount, setTweetCount] = useState(10);
  const [extractedData, setExtractedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const parseTwitterUrl = (url) => {
    const tweetMatch = url.match(/status\/(\d+)/);
    const userMatch = url.match(/twitter\.com\/([^\/\?]+)/);
    
    if (tweetMatch) {
      return { type: 'tweet', id: tweetMatch[1] };
    } else if (userMatch) {
      return { type: 'user', username: userMatch[1] };
    }
    return null;
  };

  const extractData = async () => {
    const apiKey = localStorage.getItem('twitterApiKey');
    if (!apiKey) {
      toast({
        title: "Ошибка",
        description: "Необходимо указать Twitter API ключ в настройках",
        variant: "destructive"
      });
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
    onLog('Начало извлечения данных Twitter', 'info');
    
    try {
      const results = [];

      for (const url of urls) {
        const parsed = parseTwitterUrl(url.trim());
        if (!parsed) {
          onLog(`Неверный формат URL: ${url}`, 'error');
          continue;
        }

        onLog(`Обработка: ${url}`, 'info');

        if (extractionType === 'tweets' && parsed.type === 'tweet') {
          // Извлечение отдельного твита
          const response = await fetch(`https://api.twitterapi.io/twitter/tweet/lookup?tweetId=${parsed.id}`, {
            headers: { 'X-API-Key': apiKey }
          });
          
          if (response.ok) {
            const tweetData = await response.json();
            
            // Получаем информацию о профиле автора
            let authorInfo = null;
            if (tweetData.author?.username) {
              const userResponse = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=${tweetData.author.username}`, {
                headers: { 'X-API-Key': apiKey }
              });
              if (userResponse.ok) {
                authorInfo = await userResponse.json();
              }
            }

            results.push({
              type: 'single_tweet',
              url: url,
              tweetUrl: `https://twitter.com/${tweetData.author?.username}/status/${parsed.id}`,
              data: tweetData,
              authorProfile: authorInfo
            });
          } else {
            onLog(`Ошибка получения твита ${parsed.id}: ${response.status}`, 'error');
          }
        } else if (extractionType === 'accounts' && parsed.type === 'user') {
          // Получение информации о пользователе
          const userResponse = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=${parsed.username}`, {
            headers: { 'X-API-Key': apiKey }
          });

          // Получение последних твитов
          const tweetsResponse = await fetch(`https://api.twitterapi.io/twitter/user/last_tweets?userName=${parsed.username}`, {
            headers: { 'X-API-Key': apiKey }
          });

          if (userResponse.ok && tweetsResponse.ok) {
            const userData = await userResponse.json();
            const tweetsData = await tweetsResponse.json();
            
            // Добавляем ссылки к каждому твиту
            const tweetsWithUrls = (tweetsData.tweets || []).slice(0, tweetCount).map(tweet => ({
              ...tweet,
              tweetUrl: `https://twitter.com/${parsed.username}/status/${tweet.id || 'unknown'}`
            }));

            results.push({
              type: 'user_tweets',
              url: url,
              userInfo: userData,
              tweets: tweetsWithUrls
            });
          } else {
            onLog(`Ошибка получения данных пользователя ${parsed.username}`, 'error');
          }
        } else {
          onLog(`Несоответствие типа извлечения и URL: ${url}`, 'error');
        }
      }

      const finalData = {
        extractedAt: new Date().toISOString(),
        extractionType: extractionType,
        totalResults: results.length,
        results: results
      };

      setExtractedData(finalData);
      onDataExtracted(finalData);
      onLog(`Успешно извлечено данных: ${results.length} записей`, 'success');
      
      toast({
        title: "Успех",
        description: `Извлечено ${results.length} записей`
      });

    } catch (error) {
      onLog(`Ошибка извлечения: ${error.message}`, 'error');
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при извлечении данных",
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

    onLog('JSON файл скачан', 'success');
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
                ? "Введите ссылки на твиты, каждая с новой строки:\nhttps://twitter.com/username/status/123456\nhttps://twitter.com/username/status/789012"
                : "Введите ссылки на аккаунты, каждая с новой строки:\nhttps://twitter.com/username1\nhttps://twitter.com/username2"
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
                onChange={(e) => setTweetCount(parseInt(e.target.value) || 10)}
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
                      <span className="text-sm">{result.url}</span>
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
