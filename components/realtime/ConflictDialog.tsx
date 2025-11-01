'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ConflictInfo, ConflictResolution } from '@/lib/types/realtime';
import { AlertTriangle, RefreshCw, Save, X } from 'lucide-react';

interface ConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ConflictInfo[];
  itemType: string; // e.g., "gig", "setlist", "rehearsal"
  itemName: string; // e.g., "Rock Concert", "Main Setlist"
  onResolve: (resolution: ConflictResolution) => void;
}

export function ConflictDialog({
  isOpen,
  onClose,
  conflicts,
  itemType,
  itemName,
  onResolve,
}: ConflictDialogProps) {
  const [resolutionChoices, setResolutionChoices] = React.useState<
    Record<string, 'local' | 'remote' | 'merge'>
  >({});

  if (!isOpen) return null;

  const handleFieldChoice = (field: string, choice: 'local' | 'remote' | 'merge') => {
    setResolutionChoices(prev => ({
      ...prev,
      [field]: choice,
    }));
  };

  const handleAcceptAll = (choice: 'local' | 'remote') => {
    const choices: Record<string, 'local' | 'remote' | 'merge'> = {};
    conflicts.forEach(conflict => {
      choices[conflict.field] = choice;
    });
    setResolutionChoices(choices);
  };

  const handleResolve = () => {
    const resolvedValues: Record<string, unknown> = {};
    
    conflicts.forEach(conflict => {
      const choice = resolutionChoices[conflict.field] || 'remote';
      switch (choice) {
        case 'local':
          resolvedValues[conflict.field] = conflict.localValue;
          break;
        case 'remote':
          resolvedValues[conflict.field] = conflict.remoteValue;
          break;
        case 'merge':
          // For now, merge defaults to remote - could be enhanced per field type
          resolvedValues[conflict.field] = conflict.remoteValue;
          break;
      }
    });

    const resolution: ConflictResolution = {
      action: Object.values(resolutionChoices).every(choice => choice === 'local') 
        ? 'keep-local'
        : Object.values(resolutionChoices).every(choice => choice === 'remote')
        ? 'accept-remote'
        : 'merge',
      conflicts,
      resolvedValues,
    };

    onResolve(resolution);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .replace(/^\w/, c => c.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Conflicting Changes Detected
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Someone else modified this {itemType} while you were editing it.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Item Info */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">{itemType}:</span> {itemName}
          </p>
        </div>

        {/* Conflicts List */}
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="space-y-6">
            {conflicts.map((conflict) => (
              <div key={conflict.field} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                  {formatFieldName(conflict.field)}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Your Version */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Your Version
                    </label>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
                      {formatValue(conflict.localValue)}
                    </div>
                    <Button
                      variant={resolutionChoices[conflict.field] === 'local' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleFieldChoice(conflict.field, 'local')}
                      className="w-full"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Keep Mine
                    </Button>
                  </div>

                  {/* Their Version */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Their Version
                    </label>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm">
                      {formatValue(conflict.remoteValue)}
                    </div>
                    <Button
                      variant={resolutionChoices[conflict.field] === 'remote' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleFieldChoice(conflict.field, 'remote')}
                      className="w-full"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Use Theirs
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Last modified: Your version at{' '}
                  {new Date(conflict.lastModified.local).toLocaleTimeString()}, their version at{' '}
                  {new Date(conflict.lastModified.remote).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAcceptAll('local')}
              >
                Keep All Mine
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAcceptAll('remote')}
              >
                Use All Theirs
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleResolve}
                disabled={conflicts.some(c => !resolutionChoices[c.field])}
              >
                Resolve Conflicts
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}