import { MessageQueue } from '../utils/MessageQueue.js';

describe('MessageQueue', () => {
  let messageQueue: MessageQueue;

  beforeEach(() => {
    messageQueue = new MessageQueue();
  });

  describe('addMessage', () => {
    it('should add a message to the queue', () => {
      messageQueue.addMessage('Test message', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      expect(messageQueue.getStats().totalQueued).toBe(1);
    });

    it('should emit messageAdded event when a message is added', () => {
      const eventListener = jest.fn();
      messageQueue.on('messageAdded', eventListener);

      messageQueue.addMessage('Test message', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test message',
          status: 'queued',
        })
      );
    });
  });

  describe('getQueuedMessages', () => {
    it('should return all queued messages', () => {
      messageQueue.addMessage('Message 1', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      messageQueue.addMessage('Message 2', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      const queuedMessages = messageQueue.getQueuedMessages();
      expect(queuedMessages).toHaveLength(2);
      expect(queuedMessages[0].message).toBe('Message 1');
      expect(queuedMessages[1].message).toBe('Message 2');
    });
  });

  describe('removeMessage', () => {
    it('should remove a message from the queue', () => {
      messageQueue.addMessage('Test message', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      expect(messageQueue.getStats().totalQueued).toBe(1);

      const queuedMessages = messageQueue.getQueuedMessages();
      const removed = messageQueue.removeMessage(queuedMessages[0].id);
      expect(removed).toBe(true);
      expect(messageQueue.getStats().totalQueued).toBe(0);
    });
  });

  describe('clearQueue', () => {
    it('should clear all messages from the queue', () => {
      messageQueue.addMessage('Message 1', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      messageQueue.addMessage('Message 2', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      expect(messageQueue.getStats().totalQueued).toBe(2);

      messageQueue.clearQueue();
      expect(messageQueue.getStats().totalQueued).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct queue statistics', () => {
      const stats = messageQueue.getStats();
      expect(stats).toEqual({
        totalQueued: 0,
        isProcessing: false,
        currentMessageId: undefined,
      });
    });

    it('should return correct stats with queued messages', () => {
      messageQueue.addMessage('Test message', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      const stats = messageQueue.getStats();
      expect(stats.totalQueued).toBe(1);
      expect(stats.isProcessing).toBe(false);
    });
  });
});
