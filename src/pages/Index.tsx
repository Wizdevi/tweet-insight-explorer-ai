
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TwitterExtractor from '@/components/TwitterExtractor';
import AIAnalyzer from '@/components/AIAnalyzer';
import SettingsPanel from '@/components/SettingsPanel';
import LoggingPanel from '@/components/LoggingPanel';
import { Twitter, Brain, Settings, FileText } from 'lucide-react';

const Index = () => {
  const [extractedData, setExtractedData] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const newLog = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Twitter Insight Explorer AI
          </h1>
          <p className="text-gray-600 text-lg">
            Извлекайте и анализируйте Twitter данные с помощью искусственного интеллекта
          </p>
        </header>

        <Tabs defaultValue="extractor" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="extractor" className="flex items-center gap-2">
              <Twitter className="w-4 h-4" />
              Извлечение данных
            </TabsTrigger>
            <TabsTrigger value="analyzer" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              AI Анализ
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Настройки
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Логи
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extractor">
            <TwitterExtractor 
              onDataExtracted={setExtractedData} 
              onLog={addLog}
            />
          </TabsContent>

          <TabsContent value="analyzer">
            <AIAnalyzer 
              extractedData={extractedData} 
              onLog={addLog}
            />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel onLog={addLog} />
          </TabsContent>

          <TabsContent value="logs">
            <LoggingPanel logs={logs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
