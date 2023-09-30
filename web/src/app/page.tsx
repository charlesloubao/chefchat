'use client'
import {ComputerDesktopIcon, PaperAirplaneIcon, UserIcon} from "@heroicons/react/24/outline";
import React, {FormEvent, useState} from "react";
import axios from "axios";
import ChatInput from "@/components/features/home-page/ChatInput";
import Markdown from "react-markdown";
import Image from "next/image";

export type Message = {
    role: "assistant" | "user",
    content: string
} | { role: "function", name: string, content: string }

export default function Home() {
    const [status, setStatus] = useState<"idle" | "chatbot_typing" | "error">("idle")
    const [messages, setMessages] = useState<Message[]>([
        {role: "assistant", content: "Hello there! 👋 Welcome to **ChefChat**, your personal cooking assistant. I'm here to help you find delicious recipes, answer your cooking questions, and even help with ingredient substitutions. Let's get cooking! 🍳"}
    ])

    async function sendMessage(value: string) {
        try {
            const payload: Message = {
                role: "user",
                content: value
            }
            setStatus("chatbot_typing")

            setMessages(oldValue => [...oldValue, payload])

            let result = await axios.post<Message[]>("/api/ask", {messages: [...messages, payload]})
                .then(response => response.data)

            setMessages(result)
            setStatus("idle")
        } catch (e) {
            console.error(e)
            setStatus("error")
        }
    }

    return (
        <div className={"w-full h-full flex flex-col overflow-auto"}>
            <header>
                <h1 className={"bg-gray-50  p-4 border-b shadow text-2xl font-bold"}>ChefChat</h1>
            </header>
            <main className={"flex-1 flex flex-col overflow-auto"}>
                <div className={"flex-1 overflow-auto p-6 space-y-4"}>
                    {messages
                        .filter(it => it.role !== "function") //TODO: Fix this when we save the messages to the database
                        .map((message, index) => (
                            <div className={"flex items-start gap-4"} key={`message_${index}`}>{
                                message.role === "user"
                                    ? <UserIcon width={36} height={36}/>
                                    : <Image className={"border rounded overflow-hidden"} alt={""}
                                             src={"/chatbot_avatar.png"} width={36} height={36}/>
                            }
                                <div
                                    className={"flex-1 px-4 py-2 bg-gray-50 border rounded-md shadow"}>
                                    <Markdown>{message.content}</Markdown>
                                </div>
                            </div>
                        ))}
                    {status === "chatbot_typing" &&
                        <div className={"flex items-start gap-4"}><Image className={"border rounded overflow-hidden"}
                                                                         alt={""} src={"/chatbot_avatar.png"}
                                                                         width={36} height={36}/>
                            <div
                                className={"flex-1 px-4 py-2 bg-gray-50 border rounded-md shadow"}>
                                <span>...</span>
                            </div>
                        </div>}
                    {status === "error" && <div>An error occurred.</div>}
                </div>
                <ChatInput onSubmit={sendMessage}/>
            </main>
        </div>
    )
}
