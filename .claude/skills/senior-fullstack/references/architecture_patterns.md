# Architecture Patterns

## Overview

This reference guide provides comprehensive information for senior fullstack.

## Patterns and Practices

### Pattern 1: Best Practice Implementation

**Description:**
Detailed explanation of the pattern.

**When to Use:**
- Scenario 1
- Scenario 2
- Scenario 3

**Implementation:**
```typescript
// Example code implementation
export class Example {
  // Implementation details
}
```

**Benefits:**
- Benefit 1
- Benefit 2
- Benefit 3

**Trade-offs:**
- Consider 1
- Consider 2
- Consider 3

### Pattern 2: Advanced Technique

**Description:**
Another important pattern for senior fullstack.

**Implementation:**
```typescript
// Advanced example
async function advancedExample() {
  // Code here
}
```

## Guidelines

### Code Organization
- Clear structure
- Logical separation
- Consistent naming
- Proper documentation

### Performance Considerations
- Optimization strategies
- Bottleneck identification
- Monitoring approaches
- Scaling techniques

### Security Best Practices
- Input validation
- Authentication
- Authorization
- Data protection

## Common Patterns

### Pattern A
Implementation details and examples.

### Pattern B
Implementation details and examples.

### Pattern C
Implementation details and examples.

## Anti-Patterns to Avoid

### Anti-Pattern 1
What not to do and why.

### Anti-Pattern 2
What not to do and why.

## Tools and Resources

### Recommended Tools
- Tool 1: Purpose
- Tool 2: Purpose
- Tool 3: Purpose

### Further Reading
- Resource 1
- Resource 2
- Resource 3

## Conclusion

Key takeaways for using this reference guide effectively.

## Root Cause Debugging and Reliability

### Principle

Do not treat symptoms with superficial patches.

When a bug is reported, the primary objective is to identify and fix the **root cause**, while preserving existing functionality and preventing regressions.

A solution must not be considered complete simply because the code compiles, the error disappears once, or the developer believes the issue is fixed.

### Required Investigation Process

When investigating bugs involving UI responsiveness, navigation, state, loading, or interactions requiring multiple clicks:

1. Reproduce the problem before modifying the code.
2. Identify the exact user flow that triggers the problem.
3. Determine the component, state, request, route, or event responsible.
4. Inspect the complete lifecycle of the affected component.
5. Identify the root cause rather than applying a symptom-level patch.
6. Implement the smallest architectural correction that properly solves the underlying problem.
7. Reproduce the original failure after the fix and confirm that it no longer occurs.
8. Test edge cases and regression scenarios.
9. Do not claim the problem is solved if it could not be reproduced or validated.

### Investigate Especially

- Duplicate event handlers
- Async state updates
- Stale closures
- Race conditions
- Concurrent requests
- Duplicate API requests
- Loading states
- Optimistic updates
- Rollback logic
- `useEffect` behavior and dependencies
- Component mount/unmount cycles
- Unnecessary re-renders
- Navigation and routing
- Browser history behavior
- Cache behavior
- Cache invalidation
- Hydration mismatches
- Debounce/throttle logic
- Pending promises
- Aborted requests
- Silent errors
- Console errors
- Network failures
- Slow network behavior
- Performance bottlenecks

### Diagnostic Strategy

Use evidence rather than assumptions.

When necessary:

- Add temporary instrumentation/logging.
- Inspect browser console output.
- Inspect network requests.
- Compare request timing and response order.
- Trace state changes.
- Trace route transitions.
- Measure component renders.
- Identify duplicate requests.
- Identify duplicate event execution.
- Identify which state transition causes the incorrect UI.

### Interaction Testing

For UI bugs, test at minimum:

- Single click
- Rapid double click
- Multiple rapid clicks
- Open and close repeatedly
- Navigate away and return
- Browser back and forward
- Page refresh
- Initial page load
- Slow network
- Delayed API response
- Failed API response
- Repeated navigation
- Multiple simultaneous requests

### Validation Requirements

A fix is considered validated only when:

- The original bug was reproduced before the fix, whenever reproduction is possible.
- The root cause was identified.
- The affected code was corrected.
- The original scenario was tested again.
- The original behavior no longer occurs.
- Regression scenarios were tested.
- No new console or network errors were introduced.
- The solution does not depend on accidental timing.

If the bug cannot be reproduced, do **not** claim that it has been fixed.

Instead, document:

- What was investigated
- What evidence was found
- What hypotheses were tested
- What was changed
- What could not be verified
- What additional information is required















## Debugging Anti-Patterns

### Anti-Pattern 1: Symptom-Only Fixes

Do not hide a bug with arbitrary delays, extra clicks, duplicated handlers, forced reloads, unnecessary timeouts, or other workarounds without understanding the underlying cause.

### Anti-Pattern 2: Unverified Fixes

Do not report a bug as fixed solely because:

- The application builds successfully
- The page renders once
- The error disappeared temporarily
- A code path was changed
- The developer assumes the fix works

Always validate behavior.

### Anti-Pattern 3: Timing-Dependent Fixes

Avoid solutions that only work because of a particular request timing, browser timing, artificial delay, or race-dependent behavior.

### Anti-Pattern 4: Regressions

Do not fix one flow by breaking another.

After architectural or state-management changes, verify related flows, navigation, loading states, and existing functionality.



### Anti-Pattern 5: Claiming Resolution Without Reproduction

Never claim that an intermittent or state-related bug is permanently resolved unless the original failure can be reproduced or there is sufficient evidence identifying and eliminating the root cause.

For intermittent bugs:

- Reproduce the failure multiple times when possible.
- Run the affected flow repeatedly.
- Test under slow network and delayed responses.
- Test rapid repeated interactions.
- Test navigation and remount cycles.
- Verify request ordering and state transitions.
- Add automated regression coverage when practical.

If the bug cannot be reproduced reliably, explicitly state that the fix is **not proven permanent** and describe what evidence supports the proposed fix.


### Mandatory Regression Test After Root Cause Fix

After identifying and fixing the root cause, execute a regression test for the affected flow.

The test must include:

1. Open the affected page/component.
2. Perform the interaction once.
3. Wait for the expected result.
4. Verify that the expected page/component opened successfully.
5. Repeat the complete flow at least 20 times.
6. Test rapid repeated clicks.
7. Navigate to another page.
8. Navigate back.
9. Open the affected page/component again.
10. Verify that it still opens correctly with a single click.
11. Repeat navigation and interaction cycles to detect intermittent failures.
12. Verify that no new console errors, failed requests, duplicate requests, or incorrect state transitions occur.

The bug must not be considered reliably resolved until the affected flow passes these repeated interaction and navigation tests.

When practical, convert this regression scenario into an automated test so future code changes cannot silently reintroduce the bug.