import { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApprovalType } from '../../utils/ApprovalManager.js';

interface ApprovalPromptProps {
  type: 'command' | 'edit';
  command?: string;
  filePath?: string;
  oldString?: string;
  newString?: string;
  onDecision: (approved: boolean, type?: ApprovalType) => void;
  onTimeout?: () => void;
  timeoutMs?: number;
}

export function ApprovalPrompt({
  type,
  command,
  filePath,
  oldString,
  newString,
  onDecision,
  onTimeout,
  timeoutMs = 30000, // 30 seconds default
}: ApprovalPromptProps) {
  const [selectedOption, setSelectedOption] = useState<ApprovalType | 'deny'>('once');
  const [timeLeft, setTimeLeft] = useState(Math.floor(timeoutMs / 1000));

  const options: Array<{ key: ApprovalType | 'deny'; label: string; description: string }> = [
    { key: 'once', label: '1. Allow Once', description: 'Allow this action just this time' },
    {
      key: 'session',
      label: '2. Allow for Session',
      description: 'Allow similar actions for this session',
    },
    { key: 'always', label: '3. Allow Always', description: 'Always allow this type of action' },
    { key: 'deny', label: '4. Deny', description: 'Deny this action' },
  ];

  // Handle timeout
  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeout?.();
      onDecision(false);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, onDecision, onTimeout]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      onDecision(false);
      return;
    }

    if (key.return) {
      const approved = selectedOption !== 'deny';
      const approvalType = approved ? (selectedOption as ApprovalType) : undefined;
      onDecision(approved, approvalType);
      return;
    }

    // Number keys for quick selection
    if (input >= '1' && input <= '4') {
      const optionIndex = parseInt(input) - 1;
      const option = options[optionIndex];
      if (option) {
        setSelectedOption(option.key);
        const approved = option.key !== 'deny';
        const approvalType = approved ? (option.key as ApprovalType) : undefined;
        onDecision(approved, approvalType);
      }
      return;
    }

    // Arrow key navigation
    if (key.upArrow) {
      const currentIndex = options.findIndex(opt => opt.key === selectedOption);
      const newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
      setSelectedOption(options[newIndex].key);
    } else if (key.downArrow) {
      const currentIndex = options.findIndex(opt => opt.key === selectedOption);
      const newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
      setSelectedOption(options[newIndex].key);
    }
  });

  const renderContent = () => {
    if (type === 'command') {
      return (
        <Box flexDirection="column">
          <Text color="yellow">⚠️ Command Approval Required</Text>
          <Text> </Text>
          <Text>
            Command: <Text color="cyan">{command}</Text>
          </Text>
          <Text> </Text>
          <Text>This command requires approval. Choose an option:</Text>
        </Box>
      );
    } else if (type === 'edit') {
      return (
        <Box flexDirection="column">
          <Text color="yellow">⚠️ File Edit Approval Required</Text>
          <Text> </Text>
          <Text>
            File: <Text color="cyan">{filePath}</Text>
          </Text>
          <Text> </Text>
          <Text color="red">--- Current Content ---</Text>
          <Text>{oldString || '(empty)'}</Text>
          <Text> </Text>
          <Text color="green">+++ Proposed Changes +++</Text>
          <Text>{newString || '(empty)'}</Text>
          <Text> </Text>
          <Text>Approve these changes?</Text>
        </Box>
      );
    }
    return <Text color="red">Unknown approval type</Text>;
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow">
      {renderContent()}
      <Text> </Text>

      {options.map(option => (
        <Box key={option.key}>
          <Text color={selectedOption === option.key ? 'green' : 'gray'}>
            {selectedOption === option.key ? '▶ ' : '  '}
            {option.label}
          </Text>
          <Text color="gray"> - {option.description}</Text>
        </Box>
      ))}

      <Text> </Text>
      <Box>
        <Text color="gray">Use ↑↓ arrows or 1-4 to select, Enter to confirm, Esc to cancel</Text>
        <Text color="red"> (Auto-deny in {timeLeft}s)</Text>
      </Box>
    </Box>
  );
}
