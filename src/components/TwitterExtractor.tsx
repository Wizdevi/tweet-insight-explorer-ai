
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Twitter, Plus, Download, Trash2, Link } from 'lucide-react';

const TwitterExtractor = ({ onDataExtracted, onLog }) => {
  const [urls, setUrls] = useState(['']);
  const [tweetCount, setTweetCount] = useState(10);
  const [extractedData, setExtractedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const addUrlField = () => {
    setUrls([...urls, '']);
  };

  const updateUrl = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const removeUrl = (index) => {
    if (urls.length > 1) {
      const newUrls = urls.filter((_, i) => i !== index);
      setUrls(newUrls);
    }
  };

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

    setIsLoading(true);
    onLog('Начало извлечения данных Twitter', 'info');
    
    try {
      const validUrls = urls.filter(url => url.trim());
      const results = [];

      for (const url of validUrls) {
        const parsed = parseTwitterUrl(url.trim());
        if (!parsed) {
          onLog(`Неверный формат URL: ${url}`, 'error');
          continue;
        }

        onLog(`Обработка: ${url}`, 'info');

        if (parsed.type === 'tweet') {
          // Извлечение отдельного твита
          const response = await fetch(`https://api.twitterapi.io/twitter/tweet/lookup?tweetId=${parsed.id}`, {
            headers: { 'X-API-Key': apiKey }
          });
          
          if (response.ok) {
            const tweetData = await response.json();
            results.push({
              type: 'single_tweet',
              url: url,
              data: tweetData
            });
          } else {
            onLog(`Ошибка получения твита ${parsed.id}: ${response.status}`, 'error');
          }
        } else if (parsed.type === 'user') {
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
            
            results.push({
              type: 'user_tweets',
              url: url,
              userInfo: userData,
              tweets: tweetsData.tweets?.slice(0, tweetCount) || []
            });
          } else {
            onLog(`Ошибка получения данных пользователя ${parsed.username}`, 'error');
          }
        }
      }

      const finalData = {
        extractedAt: new Date().toISOString(),
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
            <Label className="text-sm font-medium">Twitter ссылки</Label>
            <div className="space-y-2 mt-2">
              {urls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    placeholder="https://twitter.com/username или https://twitter.com/username/status/123456"
                    className="flex-1"
                  />
                  {urls.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeUrl(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addUrlField}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить ссылку
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tweetCount">Количество твитов</Label>
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
          </div>

          <Button 
            onClick={extractData} 
            disabled={isLoading || !urls.some(url => url.trim())}
            className="w-full"
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
                      <Badge variant="outline" size="sm">
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
              
              <Button onClick={downloadJson} className="w-full">
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
