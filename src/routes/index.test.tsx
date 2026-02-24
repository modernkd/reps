import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RouterProvider, createRouter, createMemoryHistory, createRootRoute } from "@tanstack/react-router";
import { Route } from "./index";
import * as cloudSync from "../lib/cloudSync";
import {
  exportWorkoutDataSnapshot,
  workoutsCollection,
  addWorkout,
  clearAllUncompletedSessions,
} from "../lib/db";

// Mock cloudSync
vi.mock("../lib/cloudSync", () => {
  return {
    isCloudSyncConfigured: vi.fn(),
    getCurrentCloudUser: vi.fn(),
    subscribeToCloudAuthState: vi.fn(),
    pullCloudSnapshot: vi.fn(),
    pushCloudSnapshot: vi.fn(),
  };
});

// Since Index calls ensureDefaultWorkoutTypes etc., we might need to wait for them.
describe("WorkoutDashboard Cloud Sync Integrations", () => {
  let router: ReturnType<typeof createRouter>;
  let unsubscribeMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up a mock router
    const rootRoute = createRootRoute();
    const indexRoute = Route.update({ getParentRoute: () => rootRoute });
    const routeTree = rootRoute.addChildren([indexRoute]);
    
    const memoryHistory = createMemoryHistory({
      initialEntries: ["/"],
    });
    
    router = createRouter({ routeTree, history: memoryHistory });

    vi.mocked(cloudSync.isCloudSyncConfigured).mockReturnValue(true);
    unsubscribeMock = vi.fn();
    vi.mocked(cloudSync.subscribeToCloudAuthState).mockReturnValue(unsubscribeMock);
    vi.mocked(cloudSync.getCurrentCloudUser).mockResolvedValue(null);
  });

  afterEach(async () => {
    // Clear DB so tests don't leak
    await clearAllUncompletedSessions();
    const keys = workoutsCollection.toArray.map(w => w.id);
    if (keys.length > 0) {
      const tx = workoutsCollection.delete(keys);
      await tx.isPersisted.promise;
    }
  });

  it("does not push remote data if pullCloudSnapshot fails", async () => {
    // 1. Initial local data
    await addWorkout({
      date: "2026-02-25",
      type: "lift",
      durationMin: 30,
      notes: "local data",
    });

    const mockUser = { id: "test-user-1", email: "test@example.com" };
    
    // Simulating the user already being signed in on mount
    vi.mocked(cloudSync.getCurrentCloudUser).mockResolvedValue(mockUser);
    
    // pullCloudSnapshot throws an error!
    vi.mocked(cloudSync.pullCloudSnapshot).mockRejectedValue(new Error("Network Error"));

    render(<RouterProvider router={router} />);

    // Wait for the sync attempt
    await waitFor(() => {
      expect(cloudSync.pullCloudSnapshot).toHaveBeenCalledWith("test-user-1");
    });

    // pushCloudSnapshot should NEVER be called since pull failed
    expect(cloudSync.pushCloudSnapshot).not.toHaveBeenCalled();

    // The local DB should remain intact
    await workoutsCollection.preload();
    expect(workoutsCollection.toArray.length).toBeGreaterThan(0);
    expect(workoutsCollection.toArray[0].notes).toBe("local data");
  });

  it("preserves local dataset when signing in a new user with NO remote data", async () => {
    // 1. Initial local data
    await addWorkout({
      date: "2026-02-26",
      type: "cardio",
      durationMin: 20,
      notes: "anonymous data",
    });

    // We start logged out, then the auth state callback is triggered
    let authStateCallback: any = null;
    vi.mocked(cloudSync.subscribeToCloudAuthState).mockImplementation((cb) => {
      authStateCallback = cb;
      return unsubscribeMock;
    });

    render(<RouterProvider router={router} />);

    // Wait for the component to mount and subscribe
    await waitFor(() => {
      expect(authStateCallback).toBeTruthy();
    });

    const mockUser = { id: "test-user-new", email: "new@example.com" };

    // Remote snapshot is completely empty! 
    vi.mocked(cloudSync.pullCloudSnapshot).mockResolvedValue({ snapshot: null, updatedAt: null });
    vi.mocked(cloudSync.pushCloudSnapshot).mockResolvedValue("2026-02-26T00:00:00Z");

    // Trigger sign in
    authStateCallback(mockUser);

    await waitFor(() => {
      expect(cloudSync.pullCloudSnapshot).toHaveBeenCalledWith("test-user-new");
    });

    // Because it was empty, it should have pushed the local data!
    await waitFor(() => {
      expect(cloudSync.pushCloudSnapshot).toHaveBeenCalled();
    });
    
    const pushCallArgs = vi.mocked(cloudSync.pushCloudSnapshot).mock.calls[0];
    expect(pushCallArgs[0]).toBe("test-user-new");
    
    // Assert the local data was pushed
    const pushedSnapshot = pushCallArgs[1];
    expect(pushedSnapshot.workouts.length).toBeGreaterThan(0);
    expect(pushedSnapshot.workouts[0].notes).toBe("anonymous data");
  });

  it("does not redundantly hydrate cloud state for same user", async () => {
    let authStateCallback: any = null;
    vi.mocked(cloudSync.subscribeToCloudAuthState).mockImplementation((cb) => {
      authStateCallback = cb;
      return unsubscribeMock;
    });

    const mockUser = { id: "test-user-same", email: "same@example.com" };
    vi.mocked(cloudSync.getCurrentCloudUser).mockResolvedValue(mockUser);
    vi.mocked(cloudSync.pullCloudSnapshot).mockResolvedValue({ snapshot: null, updatedAt: null });

    render(<RouterProvider router={router} />);

    // 1. Initial mount triggersgetCurrentCloudUser hydration
    await waitFor(() => {
      expect(cloudSync.pullCloudSnapshot).toHaveBeenCalledWith("test-user-same");
    });
    expect(cloudSync.pullCloudSnapshot).toHaveBeenCalledTimes(1);

    // 2. Auth token refreshes (same user is emitted by subscription)
    authStateCallback(mockUser);

    // Give it a tick to process
    await new Promise((r) => setTimeout(r, 50));

    // It should STILL only be 1! Redundant call prevented!
    expect(cloudSync.pullCloudSnapshot).toHaveBeenCalledTimes(1);
  });
});
