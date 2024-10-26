import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send, TrendingUp, Bot, User, Sun, Moon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const ThemeToggle = ({ theme, toggleTheme }) => (
  <Button
    onClick={toggleTheme}
    variant="ghost"
    size="icon"
    className="fixed top-4 right-4 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300"
  >
    {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
  </Button>
);

const LoadingDots = () => (
  <div className="flex space-x-1">
    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
  </div>
);

const FinancialDashboard = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [stockSymbol, setStockSymbol] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Generate sample stock data
  const generateStockData = (prediction) => {
    const basePrice = 100;
    const volatility = 0.1;
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const randomWalk = Math.random() * 2 - 1;
      const price = basePrice * (1 + randomWalk * volatility);
      return {
        date: date.toLocaleDateString(),
        actual: price,
        predicted: price * (1 + (prediction?.sentiment === 'positive' ? 0.1 : -0.05) * (i / 30))
      };
    });
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMessage = { type: 'user', content: inputMessage };
    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    setLoading(true);
    setIsTyping(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      const response = await fetch('http://localhost:8000/api/financial-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputMessage })
      });
      const data = await response.json();
      setIsTyping(false);
      setMessages(prev => [...prev, { type: 'assistant', content: data.answer }]);
    } catch (error) {
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        type: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.' 
      }]);
    }
    setLoading(false);
  };

  const handlePredictionRequest = async () => {
    if (!stockSymbol.trim()) return;
    setLoading(true);
    setPrediction(null);

    try {
      const response = await fetch('http://localhost:8000/api/stock-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_symbol: stockSymbol.toUpperCase() })
      });
      const data = await response.json();
      setPrediction({
        ...data,
        stockData: generateStockData(data)
      });
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const themeClasses = theme === 'dark' 
    ? 'bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white'
    : 'bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 text-gray-900';

  const cardClasses = theme === 'dark'
    ? 'bg-black/30 text-white border-white/10'
    : 'bg-white/70 text-gray-900 border-gray-200';

  return (
    <div className={`min-h-screen p-4 transition-colors duration-500 ${themeClasses}`}>
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
          Financial Intelligence Hub
        </h1>
        
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className={`grid w-full grid-cols-2 ${theme === 'dark' ? 'bg-black/20' : 'bg-white/20'} backdrop-blur-lg`}>
            <TabsTrigger value="chat">Financial Chat</TabsTrigger>
            <TabsTrigger value="predictions">Stock Predictions</TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <Card className={`${cardClasses} h-[600px] flex flex-col transition-colors duration-300`}>
              <CardHeader>
                <CardTitle>AI Financial Assistant</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-4 mb-4">
                <div className="space-y-4 py-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2 ${
                        message.type === 'user' ? 'justify-end' : 'justify-start'
                      } animate-slideIn`}
                    >
                      {message.type === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center animate-fadeIn">
                          <Bot size={20} />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl p-4 ${
                          message.type === 'user'
                            ? 'bg-gradient-to-r from-pink-600 to-purple-600'
                            : theme === 'dark' 
                              ? 'bg-gradient-to-r from-violet-600 to-indigo-600'
                              : 'bg-gradient-to-r from-violet-400 to-indigo-400'
                        } shadow-lg backdrop-blur-sm animate-fadeIn`}
                      >
                        {message.content}
                      </div>
                      {message.type === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center animate-fadeIn">
                          <User size={20} />
                        </div>
                      )}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center">
                        <Bot size={20} />
                      </div>
                      <div className={`rounded-2xl p-4 ${
                        theme === 'dark' 
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600'
                          : 'bg-gradient-to-r from-violet-400 to-indigo-400'
                      }`}>
                        <LoadingDots />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>
              <div className="p-4 border-t border-white/10">
                <form onSubmit={handleQuerySubmit} className="flex gap-2">
                  <Input
                    placeholder="Ask about markets, stocks, or financial advice..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={loading}
                    className={theme === 'dark' ? 'bg-white/10' : 'bg-white/50'}
                  />
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-gradient-to-r from-violet-600 to-pink-600 hover:scale-105 transition-transform duration-200"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="predictions">
            <Card className={cardClasses}>
              <CardHeader>
                <CardTitle>Stock Prediction Engine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter stock symbol (e.g., AAPL)"
                    value={stockSymbol}
                    onChange={(e) => setStockSymbol(e.target.value)}
                    className={theme === 'dark' ? 'bg-white/10' : 'bg-white/50'}
                  />
                  <Button 
                    onClick={handlePredictionRequest}
                    disabled={loading}
                    className="bg-gradient-to-r from-pink-600 to-purple-600 hover:scale-105 transition-transform duration-200"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <TrendingUp className="h-4 w-4 mr-2" />
                    )}
                    Predict
                  </Button>
                </div>

                {prediction && (
                  <div className="space-y-6 animate-slideUp">
                    <Card className={`${theme === 'dark' ? 'bg-black/40' : 'bg-white/40'} border-0`}>
                      <CardHeader>
                        <CardTitle>Price Prediction Chart</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={prediction.stockData}>
                              <defs>
                                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <XAxis 
                                dataKey="date" 
                                stroke={theme === 'dark' ? '#fff' : '#000'}
                                tick={{ fill: theme === 'dark' ? '#fff' : '#000' }}
                              />
                              <YAxis 
                                stroke={theme === 'dark' ? '#fff' : '#000'}
                                tick={{ fill: theme === 'dark' ? '#fff' : '#000' }}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  color: theme === 'dark' ? '#fff' : '#000'
                                }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="actual" 
                                stroke="#8b5cf6" 
                                fillOpacity={1}
                                fill="url(#actualGradient)"
                                strokeWidth={2}
                                name="Actual Price"
                              />
                              <Area 
                                type="monotone" 
                                dataKey="predicted" 
                                stroke="#ec4899" 
                                fillOpacity={1}
                                fill="url(#predictedGradient)"
                                strokeWidth={2}
                                name="Predicted Price"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={`${theme === 'dark' ? 'bg-black/40' : 'bg-white/40'} border-0`}>
                      <CardHeader>
                        <CardTitle>Analysis Results</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className={`whitespace-pre-wrap p-4 rounded-lg ${
                          theme === 'dark' ? 'bg-black/30 text-emerald-400' : 'bg-white/30 text-emerald-600'
                        } font-mono`}>
                          {JSON.stringify(prediction, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FinancialDashboard;