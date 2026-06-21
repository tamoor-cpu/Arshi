import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  ArrowLeft,
  Camera,
  Check,
  X,
  SkipForward,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

export default function ChecklistExecutionPage() {
  const { checklistId } = useParams();
  const { currentLocation } = useAuth();
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null);

  useEffect(() => {
    if (!currentLocation || !checklistId) return;

    // We need to fetch the checklist data. Since we started it, let's fetch completed checklists
    api
      .get(`/locations/${currentLocation.id}/checklists/completed`)
      .then(({ data }) => {
        const found = data.find((c) => c.id === checklistId);
        if (found) setChecklist(found);
      })
      .finally(() => setLoading(false));
  }, [currentLocation, checklistId]);

  const completeTask = async (taskId, status) => {
    setCompleting(taskId);
    try {
      const { data } = await api.patch(
        `/locations/${currentLocation.id}/checklists/${checklistId}/tasks/${taskId}`,
        { status, notes: '' }
      );

      // Update local state
      setChecklist((prev) => {
        if (!prev) return prev;
        const updatedResults = prev.taskResults.map((tr) =>
          tr.taskId === taskId ? { ...tr, status, completedAt: new Date().toISOString() } : tr
        );
        return {
          ...prev,
          taskResults: updatedResults,
          status: data.checklistComplete ? 'completed' : prev.status,
          completedAt: data.checklistComplete ? new Date().toISOString() : prev.completedAt,
        };
      });

      if (data.checklistComplete) {
        // Brief delay then show completion
        setTimeout(() => {}, 500);
      }
    } catch (err) {
      console.error('Complete task error:', err);
    } finally {
      setCompleting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">Checklist not found</p>
        <button onClick={() => navigate('/checklists')} className="mt-3 text-sm text-blue-600 hover:text-blue-700">
          Back to Checklists
        </button>
      </div>
    );
  }

  const tasks = checklist.template?.tasks || [];
  const results = checklist.taskResults || [];
  const completedCount = results.filter((r) => r.status !== 'pending').length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
  const isComplete = checklist.status === 'completed';

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/checklists')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{checklist.template?.name}</h1>
          <p className="text-sm text-gray-500">
            {completedCount} of {tasks.length} tasks completed
          </p>
        </div>
        {isComplete && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-full">
            <CheckCircle2 className="w-4 h-4" /> Complete
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isComplete ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Completion celebration */}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-green-800 mb-1">Checklist Complete!</h2>
          <p className="text-sm text-green-600">
            Completed at {new Date(checklist.completedAt).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task, idx) => {
          const result = results.find((r) => r.taskId === task.id);
          const isDone = result && result.status !== 'pending';
          const isPassed = result?.status === 'passed';
          const isFailed = result?.status === 'failed';
          const isSkipped = result?.status === 'skipped';

          return (
            <div
              key={task.id}
              className={`bg-white rounded-xl border p-4 transition-all ${
                isDone
                  ? isPassed
                    ? 'border-green-200 bg-green-50/50'
                    : isFailed
                    ? 'border-red-200 bg-red-50/50'
                    : 'border-gray-200 bg-gray-50/50'
                  : 'border-gray-200 hover:border-blue-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status indicator */}
                <div className="mt-0.5">
                  {isDone ? (
                    isPassed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : isFailed ? (
                      <X className="w-5 h-5 text-red-500" />
                    ) : (
                      <SkipForward className="w-5 h-5 text-gray-400" />
                    )
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </div>

                {/* Task details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{idx + 1}.</span>
                    <p className={`text-sm font-medium ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                  </div>
                  {task.section && (
                    <span className="text-xs text-gray-400 ml-5">{task.section}</span>
                  )}
                  {task.requiresPhoto && !isDone && (
                    <span className="inline-flex items-center gap-1 text-xs text-orange-600 mt-1 ml-5">
                      <Camera className="w-3 h-3" /> Photo required
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                {!isDone && !isComplete && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => completeTask(task.id, 'passed')}
                      disabled={completing === task.id}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Pass"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => completeTask(task.id, 'failed')}
                      disabled={completing === task.id}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Fail"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => completeTask(task.id, 'skipped')}
                      disabled={completing === task.id}
                      className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Skip"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
