import React, { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import classNames from 'classnames';
import { Localize } from '@deriv-com/translations';
import {
    handleGetCategories,
    handleGetMessages,
    handleCreateMessage,
    handleRegisterUser,
    handleUpdateUserStatus,
    handleGetUserStats,
    handleToggleReaction,
    handleGetOnlineUsersCount,
    handleUpdateMessage,
    handleDeleteMessage,
} from '../../api/community.api';
import { getUserEmail } from '../../utils/userSession';
import './community.scss';

interface Message {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    content: string;
    timestamp: Date;
    replyTo?: {
        id: string;
        userName: string;
        content: string;
    };
    attachments?: {
        type: 'image' | 'video';
        url: string;
    }[];
    reactions?: {
        emoji: string;
        userIds: string[];
    }[];
}

interface User {
    id: string;
    name: string;
    avatar: string;
    status: 'online' | 'offline' | 'away';
    bio: string;
    joinedDate: string;
    messagesCount: number;
}

interface Category {
    id: string;
    name: string;
    description: string;
    icon: string;
    messageCount: number;
}

const Community: React.FC = observer(() => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCategory, setActiveCategory] = useState<Category | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
    const [usernameInput, setUsernameInput] = useState('');
    const [onlineUsersCount, setOnlineUsersCount] = useState(0);
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [editInput, setEditInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isInitialLoadRef = useRef(true);

    // Common emojis
    const emojis = ['😀', '😊', '👍', '🎉', '💰', '📈', '📉', '🚀', '💪', '🔥', '❤️', '👏', '🤔', '😎', '🙏'];

    // Get loginId helper
    const getLoginId = (): string => {
        const accountsList = localStorage.getItem('accountsList');
        if (accountsList) {
            try {
                const accounts = JSON.parse(accountsList);
                const accountKeys = Object.keys(accounts);
                if (accountKeys.length > 0) {
                    return accountKeys[0];
                }
            } catch (e) {
                console.error('Error parsing accountsList:', e);
            }
        }
        return localStorage.getItem('active_loginid') || 'guest_' + Date.now();
    };

    // Initialize user and load data from database
    useEffect(() => {
        const initializeCommunity = async () => {
            try {
                const loginId = getLoginId();
                
                // Check if user exists in database first
                const statsResult = await handleGetUserStats(loginId);
                
                if (statsResult.success && statsResult.data) {
                    // User exists in database
                    setCurrentUser({
                        id: statsResult.data.id,
                        name: statsResult.data.fullName,
                        avatar: statsResult.data.avatar || '👤',
                        status: statsResult.data.status as 'online' | 'offline' | 'away',
                        bio: statsResult.data.bio || 'Trading enthusiast',
                        joinedDate: statsResult.data.joinedDate,
                        messagesCount: statsResult.data.messagesCount,
                    });

                    // Update status to online
                    await handleUpdateUserStatus(loginId, 'online');
                    
                    // Save username to localStorage for future reference
                    localStorage.setItem(`community_username_${loginId}`, statsResult.data.fullName);
                } else {
                    // User doesn't exist in database, prompt for username
                    setShowUsernamePrompt(true);
                    setLoading(false);
                    return;
                }

                // Load categories from database
                const categoriesResult = await handleGetCategories();
                if (categoriesResult.success && categoriesResult.data) {
                    setCategories(categoriesResult.data);
                    if (categoriesResult.data.length > 0) {
                        setActiveCategory(categoriesResult.data[0]);
                    }
                }
            } catch (error) {
                console.error('Error initializing community:', error);
                // If error checking database, prompt for username
                setShowUsernamePrompt(true);
            } finally {
                setLoading(false);
            }
        };

        initializeCommunity();

        // Cleanup: set status to offline on unmount
        return () => {
            const loginId = getLoginId();
            handleUpdateUserStatus(loginId, 'offline');
        };
    }, []);

    // Fetch online users count periodically
    useEffect(() => {
        const fetchOnlineCount = async () => {
            const result = await handleGetOnlineUsersCount();
            if (result.success && result.data) {
                setOnlineUsersCount(result.data.count);
            }
        };

        // Initial fetch
        fetchOnlineCount();

        // Update every 10 seconds
        const interval = setInterval(fetchOnlineCount, 10000);

        return () => clearInterval(interval);
    }, []);

    // Load messages when category changes
    useEffect(() => {
        const loadMessages = async () => {
            if (!activeCategory) return;

            // Reset initial load flag when category changes
            isInitialLoadRef.current = true;

            try {
                const result = await handleGetMessages(activeCategory.id, 50);
                
                if (result.success && result.data) {
                    const formattedMessages: Message[] = result.data.map((msg: any) => ({
                        id: msg.id,
                        userId: msg.userId,
                        userName: msg.user.fullName,
                        userAvatar: msg.user.avatar || '👤',
                        content: msg.content,
                        timestamp: new Date(msg.createdAt),
                        replyTo: msg.replyTo
                            ? {
                                  id: msg.replyTo.id,
                                  userName: msg.replyTo.user.fullName,
                                  content: msg.replyTo.content,
                              }
                            : undefined,
                        attachments: msg.attachments?.map((att: any) => ({
                            type: att.type,
                            url: att.url,
                        })),
                        reactions: msg.reactions?.map((reaction: any) => ({
                            emoji: reaction.emoji,
                            userIds: reaction.userIds,
                        })) || [],
                    }));
                    setMessages(formattedMessages);
                    
                    // Scroll to bottom instantly on initial load
                    if (isInitialLoadRef.current) {
                        setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
                            isInitialLoadRef.current = false;
                        }, 100);
                    }
                }
            } catch (error) {
                console.error('Error loading messages:', error);
                setMessages([]);
            }
        };

        loadMessages();
    }, [activeCategory]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [messageInput]);

    // Handle username submission
    const handleUsernameSubmit = async () => {
        if (!usernameInput.trim()) return;

        const loginId = getLoginId();
        const email = getUserEmail(); // Get email from session storage
        
        console.log('📝 [COMMUNITY] Submitting username:', {
            loginId,
            username: usernameInput.trim(),
            email: email || 'No email available',
        });
        
        localStorage.setItem(`community_username_${loginId}`, usernameInput.trim());

        // Register user in database with email from session
        const userResult = await handleRegisterUser(
            loginId, 
            usernameInput.trim(),
            undefined, // avatar
            email // email from session
        );
        
        console.log('📬 [COMMUNITY] Registration result:', userResult);
        
        if (userResult.success && userResult.data) {
            const statsResult = await handleGetUserStats(loginId);
            
            if (statsResult.success && statsResult.data) {
                setCurrentUser({
                    id: statsResult.data.id,
                    name: statsResult.data.fullName,
                    avatar: statsResult.data.avatar || '👤',
                    status: 'online',
                    bio: statsResult.data.bio || 'Trading enthusiast',
                    joinedDate: statsResult.data.joinedDate,
                    messagesCount: statsResult.data.messagesCount,
                });
            }

            await handleUpdateUserStatus(loginId, 'online');
        }

        setShowUsernamePrompt(false);
        setUsernameInput('');

        // Load categories after user is registered
        const categoriesResult = await handleGetCategories();
        if (categoriesResult.success && categoriesResult.data) {
            setCategories(categoriesResult.data);
            if (categoriesResult.data.length > 0) {
                setActiveCategory(categoriesResult.data[0]);
            }
        }
    };

    // Handle send message
    const handleSendMessage = async () => {
        // Allow sending if there's either text or an attachment
        if ((!messageInput.trim() && !attachmentPreview) || !currentUser || !activeCategory) return;

        try {
            const attachments = attachmentPreview ? [{
                type: 'image' as const,
                url: attachmentPreview,
            }] : undefined;

            const result = await handleCreateMessage(
                currentUser.id,
                activeCategory.id,
                messageInput.trim() || ' ', // Use space if no text but has attachment
                replyingTo?.id,
                attachments
            );

            if (result.success && result.data) {
                // Add new message to the list
                const newMessage: Message = {
                    id: result.data.id,
                    userId: result.data.userId,
                    userName: result.data.user.fullName,
                    userAvatar: result.data.user.avatar || '👤',
                    content: result.data.content,
                    timestamp: new Date(result.data.createdAt),
                    replyTo: result.data.replyTo
                        ? {
                              id: result.data.replyTo.id,
                              userName: result.data.replyTo.user.fullName,
                              content: result.data.replyTo.content,
                          }
                        : undefined,
                    attachments: result.data.attachments?.map((att: any) => ({
                        type: att.type,
                        url: att.url,
                    })),
                };

                setMessages([...messages, newMessage]);

                // Update current user's message count
                setCurrentUser({ ...currentUser, messagesCount: currentUser.messagesCount + 1 });
            }

            // Reset input
            setMessageInput('');
            setReplyingTo(null);
            setAttachmentPreview(null);
            setShowEmojiPicker(false);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check file size (max 5MB)
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                alert('File size must be less than 5MB');
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                setAttachmentPreview(event.target?.result as string);
            };
            reader.onerror = (error) => {
                console.error('Error reading file:', error);
                alert('Failed to read file. Please try again.');
            };
            reader.readAsDataURL(file);
        }
        // Reset file input to allow selecting the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleReply = (message: Message) => {
        setReplyingTo(message);
    };

    const handleReaction = async (messageId: string, emoji: string) => {
        if (!currentUser) return;

        try {
            // Optimistically update UI
            setMessages(prevMessages => 
                prevMessages.map(msg => {
                    if (msg.id === messageId) {
                        const reactions = msg.reactions || [];
                        const existingReaction = reactions.find(r => r.emoji === emoji);
                        
                        if (existingReaction) {
                            // Toggle reaction - remove if user already reacted
                            if (existingReaction.userIds.includes(currentUser.id)) {
                                const updatedUserIds = existingReaction.userIds.filter(id => id !== currentUser.id);
                                return {
                                    ...msg,
                                    reactions: updatedUserIds.length > 0
                                        ? reactions.map(r => r.emoji === emoji ? { ...r, userIds: updatedUserIds } : r)
                                        : reactions.filter(r => r.emoji !== emoji)
                                };
                            } else {
                                // Add user to existing reaction
                                return {
                                    ...msg,
                                    reactions: reactions.map(r => 
                                        r.emoji === emoji 
                                            ? { ...r, userIds: [...r.userIds, currentUser.id] } 
                                            : r
                                    )
                                };
                            }
                        } else {
                            // Add new reaction
                            return {
                                ...msg,
                                reactions: [...reactions, { emoji, userIds: [currentUser.id] }]
                            };
                        }
                    }
                    return msg;
                })
            );

            // Save to database
            await handleToggleReaction(messageId, emoji, currentUser.id);
        } catch (error) {
            console.error('Error handling reaction:', error);
            // Optionally: reload messages to sync with database
        }
    };

    const handleStartEdit = (message: Message) => {
        setEditingMessage(message);
        setEditInput(message.content);
    };

    const handleCancelEdit = () => {
        setEditingMessage(null);
        setEditInput('');
    };

    const handleSaveEdit = async () => {
        if (!editingMessage || !editInput.trim()) return;

        try {
            const result = await handleUpdateMessage(editingMessage.id, editInput.trim());
            
            if (result.success) {
                // Update local state
                setMessages(prevMessages =>
                    prevMessages.map(msg =>
                        msg.id === editingMessage.id
                            ? { ...msg, content: editInput.trim() }
                            : msg
                    )
                );
                handleCancelEdit();
            } else {
                console.error('Failed to update message:', result.error);
            }
        } catch (error) {
            console.error('Error updating message:', error);
        }
    };

    const handleDeleteMessageClick = async (messageId: string) => {
        if (!confirm('Are you sure you want to delete this message?')) return;

        try {
            const result = await handleDeleteMessage(messageId);
            
            if (result.success) {
                // Remove from local state
                setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
            } else {
                console.error('Failed to delete message:', result.error);
            }
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    };

    const handleViewProfile = (message: Message) => {
        setSelectedUser({
            id: message.userId,
            name: message.userName,
            avatar: message.userAvatar,
            status: 'online',
            bio: 'Trading enthusiast',
            joinedDate: new Date().toISOString(), // Keep as ISO string for proper formatting
            messagesCount: messages.filter(m => m.userId === message.userId).length,
        });
        setShowProfileModal(true);
    };

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const formatJoinedDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / 86400000);

        // If less than 30 days, show "X days ago"
        if (days === 0) return 'Today';
        if (days === 1) return '1 day ago';
        if (days < 30) return `${days} days ago`;

        // Otherwise show formatted date like "2nd May, 2025"
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'long' });
        const year = date.getFullYear();

        // Get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
        const getOrdinal = (n: number) => {
            const s = ['th', 'st', 'nd', 'rd'];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        return `${getOrdinal(day)} ${month}, ${year}`;
    };

    // Parse message content and detect links
    const parseMessageContent = (content: string) => {
        // URL regex pattern
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        const parts = content.split(urlPattern);
        const currentDomain = window.location.hostname;

        return parts.map((part, index) => {
            // Check if part is a URL
            if (part.match(urlPattern)) {
                try {
                    const url = new URL(part);
                    const domain = url.hostname;
                    const isSameDomain = domain === currentDomain;
                    
                    return (
                        <a
                            key={index}
                            href={part}
                            target={isSameDomain ? '_self' : '_blank'}
                            rel={isSameDomain ? undefined : 'noopener noreferrer'}
                            className="community__message-link"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {domain}
                        </a>
                    );
                } catch (e) {
                    // If URL parsing fails, return as text
                    return part;
                }
            }
            return part;
        });
    };

    if (loading) {
        return (
            <div className="community">
                <div className="community__loading">
                    <div className="community__loading-content">
                        <div className="community__loading-spinner">
                            <div className="community__loading-dot"></div>
                            <div className="community__loading-dot"></div>
                            <div className="community__loading-dot"></div>
                        </div>
                        <h3 className="community__loading-title">
                            <Localize i18n_default_text="Loading Community" />
                        </h3>
                        <p className="community__loading-subtitle">
                            <Localize i18n_default_text="Connecting you with traders worldwide..." />
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="community">
            {/* Username Prompt Modal */}
            {showUsernamePrompt && (
                <div className="community__modal-overlay">
                    <div className="community__username-prompt">
                        <h2>
                            <Localize i18n_default_text="Welcome to Community!" />
                        </h2>
                        <p>
                            <Localize i18n_default_text="Please choose a username to continue" />
                        </p>
                        <input
                            type="text"
                            placeholder="Enter your username"
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && usernameInput.trim() && handleUsernameSubmit()}
                            autoFocus
                        />
                        <button onClick={handleUsernameSubmit} disabled={!usernameInput.trim()}>
                            <Localize i18n_default_text="Continue" />
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile Sidebar Overlay */}
            {showMobileSidebar && (
                <div 
                    className="community__sidebar-overlay"
                    onClick={() => setShowMobileSidebar(false)}
                ></div>
            )}

            {/* Categories Sidebar */}
            <div className={classNames('community__sidebar', {
                'community__sidebar--mobile-open': showMobileSidebar,
            })}>
                <div className="community__sidebar-header">
                    <h3>
                        <Localize i18n_default_text="Channels" />
                    </h3>
                    <button 
                        className="community__sidebar-close"
                        onClick={() => setShowMobileSidebar(false)}
                        aria-label="Close menu"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className="community__categories">
                    {categories.map(category => (
                        <div
                            key={category.id}
                            className={classNames('community__category', {
                                'community__category--active': activeCategory?.id === category.id,
                            })}
                            onClick={() => {
                                setActiveCategory(category);
                                setShowMobileSidebar(false);
                            }}
                        >
                            <span className="community__category-icon">{category.icon}</span>
                            <div className="community__category-info">
                                <span className="community__category-name">{category.name}</span>
                                <span className="community__category-desc">{category.description}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="community__chat">
                {/* Chat Header */}
                <div className="community__chat-header">
                    <div className="community__chat-header-left">
                        {/* Mobile Menu Toggle */}
                        <button 
                            className="community__mobile-menu-toggle"
                            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                            aria-label="Toggle menu"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                        
                        <div className="community__chat-header-info">
                            <span className="community__chat-header-icon">{activeCategory?.icon}</span>
                            <div>
                                <h3>{activeCategory?.name}</h3>
                                <p>{activeCategory?.description}</p>
                            </div>
                        </div>
                    </div>
                    <div className="community__header-right">
                        <div className="community__online-count">
                            <span className="community__online-indicator"></span>
                            <span className="community__online-text">
                                {onlineUsersCount} {onlineUsersCount === 1 ? 'trader' : 'traders'} online
                            </span>
                        </div>
                        {currentUser && (
                            <div className="community__user-info" onClick={() => handleViewProfile({
                                id: currentUser.id,
                                userId: currentUser.id,
                                userName: currentUser.name,
                                userAvatar: currentUser.avatar,
                                content: '',
                                timestamp: new Date(),
                            })}>
                                <span className="community__user-avatar">{currentUser.avatar}</span>
                                <span className="community__user-name">{currentUser.name}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="community__messages">
                    {messages.length === 0 ? (
                        <div className="community__empty-state">
                            <Localize i18n_default_text="No messages yet. Start the conversation!" />
                        </div>
                    ) : (
                        messages.map(message => {
                            const isOwnMessage = currentUser && message.userId === currentUser.id;
                            return (
                                <div 
                                    key={message.id} 
                                    className={classNames('community__message', {
                                        'community__message--own': isOwnMessage
                                    })}
                                >
                                    <div className="community__message-content">
                                        <div className="community__message-header">
                                            {!isOwnMessage && (
                                                <div className="community__message-avatar" onClick={() => handleViewProfile(message)}>
                                                    {message.userAvatar}
                                                </div>
                                            )}
                                            <div className="community__message-header-text">
                                                <span className="community__message-user" onClick={() => handleViewProfile(message)}>
                                                    {message.userName}
                                                </span>
                                                <span className="community__message-time">{formatTime(message.timestamp)}</span>
                                            </div>
                                            {isOwnMessage && (
                                                <div className="community__message-avatar" onClick={() => handleViewProfile(message)}>
                                                    {message.userAvatar}
                                                </div>
                                            )}
                                        </div>
                                        {message.replyTo && (
                                            <div className="community__message-reply">
                                                <div className="community__message-reply-content">
                                                    <span className="community__message-reply-user">{message.replyTo.userName}</span>
                                                    <p>{message.replyTo.content}</p>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Message Text or Edit Input */}
                                        {editingMessage?.id === message.id ? (
                                            <div className="community__message-edit">
                                                <input
                                                    type="text"
                                                    value={editInput}
                                                    onChange={(e) => setEditInput(e.target.value)}
                                                    className="community__message-edit-input"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSaveEdit();
                                                        } else if (e.key === 'Escape') {
                                                            handleCancelEdit();
                                                        }
                                                    }}
                                                />
                                                <div className="community__message-edit-actions">
                                                    <button onClick={handleSaveEdit} className="community__message-edit-save">
                                                        Save
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="community__message-edit-cancel">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="community__message-text">{parseMessageContent(message.content)}</p>
                                        )}
                                        
                                        {message.attachments && message.attachments.length > 0 && (
                                            <div className="community__message-attachments">
                                                {message.attachments.map((att, idx) => (
                                                    <img key={idx} src={att.url} alt="attachment" />
                                                ))}
                                            </div>
                                        )}
                                        <div className="community__message-footer">
                                            {/* Reactions Display */}
                                            {message.reactions && message.reactions.length > 0 && (
                                                <div className="community__message-reactions">
                                                    {message.reactions.map((reaction, idx) => (
                                                        <button
                                                            key={idx}
                                                            className={classNames('community__message-reaction', {
                                                                'community__message-reaction--active': currentUser && reaction.userIds.includes(currentUser.id)
                                                            })}
                                                            onClick={() => handleReaction(message.id, reaction.emoji)}
                                                            title={`${reaction.userIds.length} reaction${reaction.userIds.length > 1 ? 's' : ''}`}
                                                        >
                                                            <span>{reaction.emoji}</span>
                                                            <span className="community__message-reaction-count">{reaction.userIds.length}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Quick Reactions */}
                                            <div className="community__message-quick-reactions">
                                                {['👍', '❤️', '😊', '🔥', '🚀'].map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        className="community__message-quick-reaction"
                                                        onClick={() => handleReaction(message.id, emoji)}
                                                        title={`React with ${emoji}`}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Reply Button */}
                                            <button 
                                                className="community__message-reply-btn" 
                                                onClick={() => handleReply(message)}
                                                title="Reply to this message"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M6.5 3.5L2 8L6.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M2 8H10C11.6569 8 13 9.34315 13 11V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                                {messages.filter(m => m.replyTo?.id === message.id).length > 0 && (
                                                    <span className="community__message-reply-count">
                                                        {messages.filter(m => m.replyTo?.id === message.id).length}
                                                    </span>
                                                )}
                                            </button>

                                            {/* Edit and Delete Buttons - Only for message author */}
                                            {isOwnMessage && (
                                                <div className="community__message-actions">
                                                    <button 
                                                        className="community__message-action-btn community__message-edit-btn" 
                                                        onClick={() => handleStartEdit(message)}
                                                        title="Edit message"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M11.3333 2.00004C11.5084 1.82494 11.7163 1.68605 11.9451 1.59129C12.1738 1.49653 12.4191 1.44775 12.6666 1.44775C12.9142 1.44775 13.1595 1.49653 13.3882 1.59129C13.617 1.68605 13.8249 1.82494 14 2.00004C14.1751 2.17513 14.314 2.383 14.4088 2.61178C14.5035 2.84055 14.5523 3.08588 14.5523 3.33337C14.5523 3.58087 14.5035 3.8262 14.4088 4.05497C14.314 4.28375 14.1751 4.49162 14 4.66671L5.00001 13.6667L1.33334 14.6667L2.33334 11L11.3333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    </button>
                                                    <button 
                                                        className="community__message-action-btn community__message-delete-btn" 
                                                        onClick={() => handleDeleteMessageClick(message.id)}
                                                        title="Delete message"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M2 4H3.33333H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                            <path d="M5.33333 4.00004V2.66671C5.33333 2.31309 5.47381 1.97395 5.72386 1.7239C5.97391 1.47385 6.31304 1.33337 6.66666 1.33337H9.33333C9.68695 1.33337 10.0261 1.47385 10.2761 1.7239C10.5262 1.97395 10.6667 2.31309 10.6667 2.66671V4.00004M12.6667 4.00004V13.3334C12.6667 13.687 12.5262 14.0261 12.2761 14.2762C12.0261 14.5262 11.687 14.6667 11.3333 14.6667H4.66666C4.31304 14.6667 3.97391 14.5262 3.72386 14.2762C3.47381 14.0261 3.33333 13.687 3.33333 13.3334V4.00004H12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="community__input-container">
                    {replyingTo && (
                        <div className="community__replying-to">
                            <span>
                                <Localize i18n_default_text="Replying to" /> {replyingTo.userName}
                            </span>
                            <button onClick={() => setReplyingTo(null)}>✕</button>
                        </div>
                    )}
                    {attachmentPreview && (
                        <div className="community__attachment-preview">
                            <img src={attachmentPreview} alt="preview" />
                            <button onClick={() => setAttachmentPreview(null)}>✕</button>
                        </div>
                    )}
                    <div className="community__input-wrapper">
                        <button
                            className="community__input-btn"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            📎
                        </button>
                        <textarea
                            ref={textareaRef}
                            className="community__input"
                            placeholder="Type a message..."
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            disabled={!currentUser}
                            rows={1}
                        />
                        <button
                            className="community__input-btn"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            😊
                        </button>
                        <button
                            className="community__input-btn community__input-btn--send"
                            onClick={handleSendMessage}
                            disabled={(!messageInput.trim() && !attachmentPreview) || !currentUser}
                        >
                            ➤
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            multiple={false}
                        />
                    </div>
                    {showEmojiPicker && (
                        <div className="community__emoji-picker">
                            {emojis.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => {
                                        setMessageInput(messageInput + emoji);
                                        setShowEmojiPicker(false);
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Modal */}
            {showProfileModal && selectedUser && (
                <div className="community__modal-overlay" onClick={() => setShowProfileModal(false)}>
                    <div className="community__profile-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="community__profile-close" onClick={() => setShowProfileModal(false)}>
                            ✕
                        </button>
                        <div className="community__profile-header">
                            <div className="community__profile-avatar">{selectedUser.avatar}</div>
                            <h2>{selectedUser.name}</h2>
                            <div className={`community__profile-status community__profile-status--${selectedUser.status}`}>
                                {selectedUser.status}
                            </div>
                        </div>
                        <div className="community__profile-body">
                            <div className="community__profile-field">
                                <label>
                                    <Localize i18n_default_text="Bio" />
                                </label>
                                <p>{selectedUser.bio}</p>
                            </div>
                            <div className="community__profile-stats">
                                <div className="community__profile-stat">
                                    <span className="community__profile-stat-value">{selectedUser.messagesCount}</span>
                                    <span className="community__profile-stat-label">
                                        <Localize i18n_default_text="Messages" />
                                    </span>
                                </div>
                                <div className="community__profile-stat">
                                    <span className="community__profile-stat-value">{formatJoinedDate(selectedUser.joinedDate)}</span>
                                    <span className="community__profile-stat-label">
                                        <Localize i18n_default_text="Joined" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default Community;
