# Package Updates Todo List

## Major Package Updates Required

### High Priority
- [ ] **Update OpenAI package from 4.104.0 to 5.16.0**
  - Research breaking changes in v5
  - Update code that uses OpenAI SDK
  - Test OpenAI provider functionality

- [ ] **Update React from 18.3.1 to 19.1.1**
  - Check for breaking changes in React 19
  - Update components and hooks usage
  - Update related React dependencies (@types/react, @types/react-dom)

- [ ] **Run full test suite after updates**
  - Execute all unit tests
  - Run E2E tests
  - Verify CI/CD pipeline passes

### Medium Priority
- [x] **Update Jest from 29.7.0 to 30.1.1** ✅ COMPLETED
  - Updated package.json with Jest 30.1.1 and jest-environment-jsdom 30.1.1
  - Installed packages successfully
  - **⚠️ BREAKING CHANGES DETECTED**: Jest 30 ESM changes require code updates
  - Need to import jest from '@jest/globals' instead of using global jest
  - Need to use jest.unstable_mockModule for ESM mocking
  - Several tests failing due to jest.mock not being a function

- [ ] **Update related React dependencies**
  - @types/react to match React 19
  - @types/react-dom to match React 19
  - ink and related packages if needed

## Already Up-to-Date Packages
- @anthropic-ai/sdk: 0.60.0 ✓
- @modelcontextprotocol/sdk: 1.17.4 ✓
- typescript: 5.9.2 ✓

## Notes
- Major version updates may require significant code changes
- Test thoroughly after each update
- Consider updating in stages rather than all at once
- Check changelogs for each package before updating