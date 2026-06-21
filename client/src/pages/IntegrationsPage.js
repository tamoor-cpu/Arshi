import React, { useState } from 'react';
import ApiKeyManager from '../components/admin/ApiKeyManager';
import WebhookManager from '../components/admin/WebhookManager';
import { Key, Webhook } from 'lucide-react';

const TABS = [
  { key: 'api-keys', label: 'API Keys', icon: Key },
  { key: 'webhooks', label: 'Webhooks', icon: Webhook },
];

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('api-keys');

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500">Manage API keys and webhook endpoints for third-party integrations</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'api-keys' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4" /> API Keys
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            API keys allow third-party services to access the ARSHI API. Keys are shown only once when created.
          </p>
          <ApiKeyManager />
        </div>
      )}

      {activeTab === 'webhooks' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Webhook className="w-4 h-4" /> Webhooks
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Webhooks send real-time notifications to your endpoints when events occur. Deliveries are signed with HMAC-SHA256.
          </p>
          <WebhookManager />
        </div>
      )}
    </div>
  );
}
