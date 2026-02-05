"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { CCMessages } from "@/components/chat/cc-messages";
import { PromptForm } from "@/components/chat/prompt-form";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import type { SessionEntry, ConversationResponse } from "@/lib/types";
import { PanelRight } from "lucide-react";

export default function Home() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConversationResponse["status"]>("idle");
  const [messages, setMessages] = useState<SessionEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showWorkspace, setShowWorkspace] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Polling for conversation updates
  useEffect(() => {
    if (!conversationId || status !== "running") return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/conversations/${conversationId}`);
        if (response.ok) {
          const data: ConversationResponse = await response.json();
          setMessages(data.messages);
          setStatus(data.status);
          setErrorMessage(data.errorMessage || null);
          setRefreshTrigger((prev) => prev + 1);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [conversationId, status]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    async (content: string) => {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            content,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to send message");
        }

        const data = await response.json();
        setConversationId(data.conversationId);
        setStatus("running");

        // Optimistically add user message to display
        const userMessage: SessionEntry = {
          type: "user",
          uuid: `temp-${Date.now()}`,
          parentUuid: null,
          sessionId: "",
          timestamp: new Date().toISOString(),
          isSidechain: false,
          message: {
            role: "user",
            content,
          },
        };
        setMessages((prev) => [...prev, userMessage]);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [conversationId]
  );

  const isLoading = status === "running" || isSubmitting;
  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header - minimal like Maru */}
      <header className="flex items-center justify-between border-b border-border px-4 h-[52px]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">hackathon-starter</span>
        </div>
        {!showWorkspace && (
          <button
            onClick={() => setShowWorkspace(true)}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="Open workspace"
          >
            <PanelRight className="size-4 text-muted-foreground" />
          </button>
        )}
      </header>

      {/* Main content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Chat panel */}
        <ResizablePanel defaultSize={showWorkspace ? 55 : 100} minSize={40}>
          <div className="flex h-full flex-col">
            {/* Messages area */}
            <div className="flex-1 overflow-auto">
              {!hasMessages ? (
                <div className="flex h-full flex-col items-center justify-center px-4">
                  <h1 className="font-mono text-lg mb-6">
                    ✳ What can I help with?
                  </h1>
                  <div className="w-full max-w-xl">
                    <PromptForm
                      onSubmit={handleSubmit}
                      isLoading={isLoading}
                      disabled={status === "running"}
                      placeholder="Ask anything"
                    />
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto px-4 py-6">
                  <CCMessages entries={messages} />
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Error display */}
            {errorMessage && (
              <div className="mx-4 mb-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            {/* Status indicator */}
            {status === "running" && hasMessages && (
              <div className="mx-4 mb-2 text-sm text-muted-foreground">
                <span className="animate-pulse">Processing...</span>
              </div>
            )}

            {/* Bottom prompt form (only when there are messages) */}
            {hasMessages && (
              <div className="border-t border-border p-4">
                <div className="max-w-3xl mx-auto">
                  <PromptForm
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    disabled={status === "running"}
                    placeholder="Follow-up message..."
                  />
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        {showWorkspace && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={45} minSize={25}>
              <WorkspacePanel
                conversationId={conversationId}
                refreshTrigger={refreshTrigger}
                onClose={() => setShowWorkspace(false)}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
