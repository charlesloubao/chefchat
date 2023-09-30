'use client'
import {ComputerDesktopIcon, PaperAirplaneIcon, UserIcon} from "@heroicons/react/24/outline";
import React, {FormEvent, useState} from "react";
import axios from "axios";
import ChatInput from "@/components/features/home-page/ChatInput";
import Markdown from "react-markdown";

export type Message = {
    role: "assistant" | "user",
    content: string
} | { role: "function", name: string, content: string }

export default function Home() {
    const [status, setStatus] = useState<"idle" | "chatbot_typing" | "error">("idle")
    const [messages, setMessages] = useState<Message[]>([])

    async function sendMessage(value: string) {
        try {
            const payload: Message = {
                role: "user",
                content: value
            }
            setStatus("chatbot_typing")

            setMessages(oldValue => [...oldValue, payload])

            let result = await axios.post<Message>("/api/ask", {messages: [...messages, payload]})
                .then(response => response.data)

            setMessages(oldValue => [...oldValue, result])
            setStatus("idle")
        } catch (e) {
            console.error(e)
            setStatus("error")
        }
    }

    return (
        <div className={"w-full h-full flex flex-col overflow-auto"}>
            <header>
                <h1>ChefChat</h1>
            </header>
            <main className={"flex-1 flex flex-col overflow-auto"}>
                <div className={"flex-1 overflow-auto"}>
                    {messages.map((message, index) => (
                        <div className={"flex items-start"} key={`message_${index}`}>{
                            message.role === "user"
                                ? <UserIcon width={24} height={24}/>
                                : <ComputerDesktopIcon width={24} height={24}/>
                        }
                            <div
                                className={"flex-1 px-4 py-2 bg-gray-50 border"}>
                                <Markdown>{message.content}</Markdown>
                            </div>
                        </div>
                    ))}
                    {status === "chatbot_typing" && <div>...</div>}
                    {status === "error" && <div>An error occurred.</div>}
                </div>
                <ChatInput onSubmit={sendMessage}/>
            </main>
        </div>
    )
}
