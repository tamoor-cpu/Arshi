import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { Send, Megaphone, MessageSquare, Users } from 'lucide-react';

export default function ChatPage() {
  const { currentLocation, user } = useAuth();
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('chat'); // 'chat' | 'announcements'
  const messagesEndRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const type = tab === 'announcements' ? 'announcement' : undefined;
      const { data } = await api.get(`/locations/${currentLocation.id}/messages`, {
        params: { type },
      });
      setMessages(data);
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  }, [currentLocation, tab]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };

    socket.on('new-message', handleNewMessage);
    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [socket]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      const { data: sent } = await api.post(`/locations/${currentLocation.id}/messages`, {
        messageText: input.trim(),
        messageType: tab === 'announcements' ? 'announcement' : 'chat',
      });
      setInput('');
      // Fallback: show the sent message immediately even if the socket echo
      // never arrives. Dedupe by id so the socket round-trip doesn't double it.
      if (sent && sent.id) {
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  if (!currentLocation) return null;

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Team Chat</h1>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === 'chat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Chat
            </button>
            <button
              onClick={() => setTab('announcements')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === 'announcements' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" /> Announcements
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-3">
        {messages.length > 0 ? (
          messages.map((msg) => {
            const isMe = msg.userId === user.id || msg.user?.id === user.id;
            const senderName = msg.user ? `${msg.user.firstName} ${msg.user.lastName}` : 'Unknown';
            const initials = msg.user ? `${msg.user.firstName?.[0]}${msg.user.lastName?.[0]}` : '?';
            const isAnnouncement = msg.messageType === 'announcement';

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isAnnouncement ? 'bg-amber-100 text-amber-700' : isMe ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {isAnnouncement ? <Megaphone className="w-3.5 h-3.5" /> : initials}
                </div>
                <div className={`max-w-[75%] ${isMe ? 'text-right' : ''}`}>
                  <p className="text-xs text-gray-400 mb-0.5">
                    {senderName}
                    {isAnnouncement && <span className="ml-1.5 text-amber-600 font-medium">ANNOUNCEMENT</span>}
                  </p>
                  <div className={`inline-block rounded-2xl px-4 py-2 text-sm ${
                    isAnnouncement
                      ? 'bg-amber-50 border border-amber-200 text-gray-900'
                      : isMe
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                  }`}>
                    {msg.messageText}
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {(tab === 'chat' || (tab === 'announcements' && isManager)) && (
        <div className="bg-white border-t px-4 lg:px-6 py-3">
          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={tab === 'announcements' ? 'Write an announcement...' : 'Type a message...'}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
