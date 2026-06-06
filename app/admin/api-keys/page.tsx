'use client';

import { useState } from 'react';
import { Copy, Eye, EyeOff, RefreshCw, Trash2 } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  lastUsed: string;
  created: string;
  status: 'active' | 'inactive';
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Default Integration',
      key: process.env.NEXT_PUBLIC_DEMO_MODE ? 'fo_live_10177805...860515dc2b3f' : 'fo_live_10177805c8d743e1a6e1860515dc2b3f',
      lastUsed: 'Never',
      created: new Date().toISOString().split('T')[0],
      status: 'active',
    },
  ]);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');

  const generateApiKey = () => {
    const prefix = 'fo_live_';
    const randomPart = Array.from({ length: 32 }, () =>
      Math.random().toString(36).charAt(2)
    ).join('');
    return prefix + randomPart;
  };

  const handleCreateKey = () => {
    if (!newKeyName) return;

    const newKey = generateApiKey();
    const newApiKey: ApiKey = {
      id: Date.now().toString(),
      name: newKeyName,
      key: newKey,
      lastUsed: 'Never',
      created: new Date().toISOString().split('T')[0],
      status: 'active',
    };

    setApiKeys([...apiKeys, newApiKey]);
    setGeneratedKey(newKey);
    setNewKeyName('');
    setShowNewKeyModal(false);
  };

  const handleDeleteKey = (id: string) => {
    if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      setApiKeys(apiKeys.filter(key => key.id !== id));
    }
  };

  const handleToggleStatus = (id: string) => {
    setApiKeys(apiKeys.map(key =>
      key.id === id
        ? { ...key, status: key.status === 'active' ? 'inactive' : 'active' }
        : key
    ));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const maskKey = (key: string) => {
    return key.substring(0, 15) + '...' + key.substring(key.length - 10);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
        <p className="mt-2 text-gray-600">
          Manage API keys for external integrations
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total Keys</div>
          <div className="text-2xl font-bold">{apiKeys.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Active Keys</div>
          <div className="text-2xl font-bold text-green-600">
            {apiKeys.filter(k => k.status === 'active').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Inactive Keys</div>
          <div className="text-2xl font-bold text-gray-400">
            {apiKeys.filter(k => k.status === 'inactive').length}
          </div>
        </div>
      </div>

      {/* Generated Key Alert */}
      {generatedKey && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-green-800">New API Key Created</div>
              <div className="text-sm text-green-600 mt-1">
                Make sure to copy this key now. You won't be able to see it again!
              </div>
              <div className="font-mono text-sm mt-2 p-2 bg-white rounded border">
                {generatedKey}
              </div>
            </div>
            <button
              onClick={() => {
                copyToClipboard(generatedKey);
                setGeneratedKey('');
              }}
              className="ml-4 p-2 text-green-600 hover:text-green-800"
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Create New Key */}
      <div className="mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="API Key Name (e.g., Production Server)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleCreateKey}
            disabled={!newKeyName}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            Create API Key
          </button>
        </div>
      </div>

      {/* API Keys Table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                API Key
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Used
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {apiKeys.map((apiKey) => (
              <tr key={apiKey.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {apiKey.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-gray-600">
                      {showKey[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                    </code>
                    <button
                      onClick={() => setShowKey({ ...showKey, [apiKey.id]: !showKey[apiKey.id] })}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showKey[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(apiKey.key)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleStatus(apiKey.id)}
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      apiKey.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {apiKey.status}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {apiKey.lastUsed}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {apiKey.created}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newKey = generateApiKey();
                        setApiKeys(apiKeys.map(k =>
                          k.id === apiKey.id ? { ...k, key: newKey } : k
                        ));
                        setGeneratedKey(newKey);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                      title="Regenerate"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteKey(apiKey.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Usage Instructions */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">How to use API Keys</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div>
            <strong>Authorization Header:</strong>
            <code className="ml-2 px-2 py-1 bg-white rounded">
              Authorization: Bearer fo_live_your_api_key_here
            </code>
          </div>
          <div>
            <strong>X-API-Key Header:</strong>
            <code className="ml-2 px-2 py-1 bg-white rounded">
              X-API-Key: fo_live_your_api_key_here
            </code>
          </div>
          <div>
            <strong>Rate Limits:</strong>
            <span className="ml-2">100 requests per minute per key</span>
          </div>
          <div>
            <strong>Webhook Endpoints:</strong>
            <ul className="mt-2 ml-4 list-disc">
              <li>POST /api/notifications - Create notification</li>
              <li>GET /api/notifications - List notifications</li>
              <li>GET /api/events/seen/[eventId] - Check if event seen</li>
              <li>POST /api/events/mark-seen - Mark event as seen</li>
              <li>GET /api/deals/[dealId] - Get deal details</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}