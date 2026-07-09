@id:REQ-ae3153e9 @backend @status:accepted @v1 @code:src/lib/queue.ts @code:src/instrumentation.ts @code:prisma/schema.prisma
Feature: Background job queue for asynchronous agent execution

In order to process long-running agent tasks without blocking the UI / As the system / I want to enqueue jobs and process them with in-memory workers

  Scenario: Enqueue a request processing job
    Given A request is filed or retried
    When The system calls enqueueRequestProcessing with the request ID
    Then A Job record is created with kind 'process_request' and status 'queued'
    And The job payload contains the requestId
    And The in-memory worker picks it up asynchronously

  Scenario: Worker processes jobs in order
    Given Multiple jobs are queued
    When The worker loop runs
    Then Jobs are picked in FIFO order (oldest first)
    And Each job's status changes to 'running' while processing
    And On success, status becomes 'completed' and result is stored
    And On error, status becomes 'failed' and error is logged
