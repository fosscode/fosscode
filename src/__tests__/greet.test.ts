import { greetUser } from '../greet';

describe('greetUser', () => {
  it('should greet with provided name', () => {
    const result = greetUser('Alice');
    expect(result).toBe('Hello, Alice!');
  });

  it('should greet with default "user" when no name provided', () => {
    const result = greetUser();
    expect(result).toBe('Hello, user!');
  });

  it('should greet with empty string name', () => {
    const result = greetUser('');
    expect(result).toBe('Hello, !');
  });
});