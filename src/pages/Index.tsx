
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
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: `url('/lovable-uploads/99861b7b-716d-41f5-8f77-cb35a2a9042f.png')`
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/30"></div>
      
      <div className="relative z-10 container mx-auto p-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg mb-2">
            Twitter Insight Explorer AI
          </h1>
          <p className="text-white/90 text-lg drop-shadow">
            Извлекайте и анализируйте Twitter данные с помощью искусственного интеллекта
          </p>
        </header>

        <Tabs defaultValue="extractor" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-white/10 backdrop-blur-sm">
            <TabsTrigger 
              value="extractor" 
              className="flex items-center gap-2 text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Twitter className="w-4 h-4" />
              Извлечение данных
            </TabsTrigger>
            <TabsTrigger 
              value="analyzer" 
              className="flex items-center gap-2 text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <Brain className="w-4 h-4" />
              AI Анализ
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="flex items-center gap-2 text-white data-[state=active]:bg-green-600 data-[state=active]:text-white"
            >
              <Settings className="w-4 h-4" />
              Настройки
            </TabsTrigger>
            <TabsTrigger 
              value="logs" 
              className="flex items-center gap-2 text-white data-[state=active]:bg-orange-600 data-[state=active]:text-white"
            >
              <FileText className="w-4 h-4" />
              Логи
            </TabsTrigger>
          </TabsList>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6">
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
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
