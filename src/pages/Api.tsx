
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { handleApiRequest } from '@/services/apiService';

// Esta é uma página especial que funciona como uma API REST
// O n8n ou qualquer ferramenta externa pode chamar estes endpoints
const Api = () => {
  const location = useLocation();
  
  useEffect(() => {
    const handleRequest = async () => {
      try {
        // Extrair o caminho da API da URL
        const path = location.pathname.replace('/api', '');
        const endpoint = `/api${path}`;
        
        // Extrair query params
        const queryParams = new URLSearchParams(location.search);
        const data: Record<string, any> = {};
        queryParams.forEach((value, key) => {
          data[key] = value;
        });
        
        // Simular extração de corpo da solicitação e cabeçalhos
        // Em uma API real, isso viria da requisição HTTP
        const method = queryParams.get('_method') || 'GET';
        const apiKey = queryParams.get('apiKey') || '';
        
        // Se houver um corpo JSON, parseá-lo
        if (queryParams.get('body')) {
          try {
            const bodyData = JSON.parse(queryParams.get('body') || '{}');
            Object.assign(data, bodyData);
          } catch (e) {
            console.error('Erro ao fazer parse do corpo JSON', e);
          }
        }
        
        // Processar a solicitação
        const result = await handleApiRequest(endpoint, method, data, {
          'x-api-key': apiKey
        });
        
        // Exibir resultado como JSON
        document.getElementById('api-result')!.textContent = JSON.stringify(result, null, 2);
      } catch (error) {
        console.error("Erro na API:", error);
        document.getElementById('api-result')!.textContent = JSON.stringify({
          error: (error as Error).message || 'Erro desconhecido'
        }, null, 2);
      }
    };
    
    handleRequest();
  }, [location]);
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-6">API MexFood</h1>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-2">Resultado:</h2>
        <pre id="api-result" className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
          Processando requisição...
        </pre>
      </div>
      
      <div className="mt-8">
        <h2 className="text-lg font-medium mb-2">Documentação da API:</h2>
        
        <div className="space-y-4">
          <div className="border p-4 rounded">
            <h3 className="font-bold">Criar Pedido</h3>
            <p className="text-sm text-gray-600">POST /api/orders</p>
            <p className="text-sm mt-2">Exemplo:</p>
            <pre className="bg-gray-100 p-2 rounded text-xs mt-1 overflow-auto">
{`{
  "customerName": "João Silva",
  "customerPhone": "+5511999999999",
  "items": [
    { "menuItemId": "4", "quantity": 2 },
    { "menuItemId": "7", "quantity": 1 }
  ]
}`}
            </pre>
          </div>
          
          <div className="border p-4 rounded">
            <h3 className="font-bold">Buscar Pedidos por Telefone</h3>
            <p className="text-sm text-gray-600">GET /api/orders?phone=+5511999999999</p>
          </div>
          
          <div className="border p-4 rounded bg-green-50">
            <h3 className="font-bold text-green-800">Buscar Pedido por ID/Número</h3>
            <p className="text-sm text-gray-600">GET /api/orders/detail?orderId=abc123</p>
            <p className="text-sm mt-2 text-green-700">✨ Novo endpoint para n8n</p>
            <p className="text-sm mt-2">Exemplo de uso no n8n (HTTP Request):</p>
            <pre className="bg-gray-100 p-2 rounded text-xs mt-1 overflow-auto">
{`URL: https://seu-dominio.com/api/orders/detail
Query Parameters:
  - orderId: ID_DO_PEDIDO
  - apiKey: mex-food-api-12345

Headers:
  - x-api-key: mex-food-api-12345`}
            </pre>
          </div>
          
          <div className="border p-4 rounded">
            <h3 className="font-bold">Atualizar Status do Pedido</h3>
            <p className="text-sm text-gray-600">PUT /api/orders/status</p>
            <p className="text-sm mt-2">Exemplo:</p>
            <pre className="bg-gray-100 p-2 rounded text-xs mt-1 overflow-auto">
{`{
  "orderId": "abc123",
  "updates": {
    "status": "confirmed"
  }
}`}
            </pre>
          </div>
        </div>
        
        <div className="mt-6 text-sm text-gray-600">
          <p><strong>Nota:</strong> Todas as requisições precisam incluir a chave de API no cabeçalho <code>x-api-key</code>.</p>
          <p>Exemplo de chave para testes: <code>mex-food-api-12345</code></p>
        </div>
      </div>
    </div>
  );
};

export default Api;
