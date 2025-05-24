
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, Key, Shield } from 'lucide-react';

const SettingsPanel = ({ onLog }) => {
  const [twitterApiKey, setTwitterApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    // Загрузка сохраненных настроек
    const savedTwitterKey = localStorage.getItem('twitterApiKey');
    const savedOpenaiKey = localStorage.getItem('openaiApiKey');
    
    if (savedTwitterKey) setTwitterApiKey(savedTwitterKey);
    if (savedOpenaiKey) setOpenaiApiKey(savedOpenaiKey);
  }, []);

  const saveSettings = () => {
    localStorage.setItem('twitterApiKey', twitterApiKey);
    localStorage.setItem('openaiApiKey', openaiApiKey);
    
    toast({
      title: "Настройки сохранены",
      description: "API ключи успешно сохранены в локальном хранилище"
    });
    
    onLog('Настройки API ключей обновлены', 'info');
  };

  const clearSettings = () => {
    localStorage.removeItem('twitterApiKey');
    localStorage.removeItem('openaiApiKey');
    setTwitterApiKey('');
    setOpenaiApiKey('');
    
    toast({
      title: "Настройки очищены",
      description: "Все API ключи удалены из локального хранилища"
    });
    
    onLog('Настройки API ключей очищены', 'info');
  };

  const maskApiKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return key;
    return key.substring(0, 4) + '***' + key.substring(key.length - 4);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" />
            Настройки API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Безопасность данных</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  API ключи сохраняются только в локальном хранилище вашего браузера и не передаются на сторонние серверы.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="twitterApiKey" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Twitter API Key
              </Label>
              <Input
                id="twitterApiKey"
                type="password"
                value={twitterApiKey}
                onChange={(e) => setTwitterApiKey(e.target.value)}
                placeholder="Введите ваш Twitter API ключ..."
                className="mt-1"
              />
              {twitterApiKey && (
                <p className="text-xs text-gray-500 mt-1">
                  Сохранен: {maskApiKey(twitterApiKey)}
                </p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                Получите API ключ на{' '}
                <a href="https://twitterapi.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  TwitterAPI.io
                </a>
              </p>
            </div>

            <div>
              <Label htmlFor="openaiApiKey" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                OpenAI API Key
              </Label>
              <Input
                id="openaiApiKey"
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="Введите ваш OpenAI API ключ..."
                className="mt-1"
              />
              {openaiApiKey && (
                <p className="text-xs text-gray-500 mt-1">
                  Сохранен: {maskApiKey(openaiApiKey)}
                </p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                Получите API ключ на{' '}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  OpenAI Platform
                </a>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveSettings} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Сохранить настройки
            </Button>
            <Button variant="outline" onClick={clearSettings}>
              Очистить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Информация об API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-sm">Twitter API</h4>
            <p className="text-xs text-gray-600 mt-1">
              Используется для извлечения твитов, информации о пользователях и метрик вовлеченности.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-sm">OpenAI API</h4>
            <p className="text-xs text-gray-600 mt-1">
              Используется для AI анализа извлеченных данных Twitter с помощью различных языковых моделей.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPanel;
