import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { getSduiNews } from '../api';
import type { SduiNews } from '../types';

interface SduiNewsListProps {
    token: string;
}

interface NewsItemProps {
    news: SduiNews;
    onNewsClick: (news: SduiNews) => void;
}

function NewsItem({ news, onNewsClick }: NewsItemProps): ReactElement {
    // Format the date
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    // Extract and truncate content for preview
    const getPreviewContent = (content: string, maxLength: number = 150) => {
        // Remove basic HTML tags for preview
        const plainText = content.replace(/<[^>]*>/g, '');
        if (plainText.length <= maxLength) return plainText;
        return plainText.substring(0, maxLength) + '...';
    };

    return (
        <article
            className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onNewsClick(news)}
        >
            <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-2 text-lg">
                        {news.title}
                    </h3>
                    {news.attachments && news.attachments.length > 0 && (
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="text-sm">{news.attachments.length}</span>
                        </div>
                    )}
                </div>
                
                <p className="text-slate-600 dark:text-slate-300 line-clamp-3">
                    {getPreviewContent(news.content)}
                </p>
                
                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                        {news.author && (
                            <span>By {news.author}</span>
                        )}
                    </div>
                    <time dateTime={news.createdAt}>
                        {formatDate(news.createdAt)}
                    </time>
                </div>
            </div>
        </article>
    );
}

export default function SduiNewsList({ token }: SduiNewsListProps): ReactElement {
    const [news, setNews] = useState<SduiNews[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMorePages, setHasMorePages] = useState(true);
    const [selectedNews, setSelectedNews] = useState<SduiNews | null>(null);

    const loadNews = useCallback(async (page: number, append: boolean = false) => {
        if (loading) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await getSduiNews(token, page);
            
            if (response.data && Array.isArray(response.data)) {
                if (append) {
                    setNews(prev => [...prev, ...response.data]);
                } else {
                    setNews(response.data);
                }
                
                // Check if we have more pages (this is a rough estimate)
                // The API might provide pagination info in meta, adjust as needed
                setHasMorePages(response.data.length > 0);
            } else {
                setNews([]);
                setHasMorePages(false);
            }
        } catch (err: unknown) {
            console.error('Failed to load Sdui news:', err);
            const error = err as { response?: { status?: number } };
            if (error.response?.status === 401) {
                setError('Authentication failed. Please check your Sdui credentials.');
            } else if (error.response?.status === 403) {
                setError('Access denied. You may not have permission to view Sdui news.');
            } else {
                setError('Failed to load news. Please try again later.');
            }
            
            if (!append) {
                setNews([]);
            }
            setHasMorePages(false);
        } finally {
            setLoading(false);
        }
    }, [token, loading]);

    // Load initial news
    useEffect(() => {
        loadNews(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // Load more news when reaching the bottom
    const loadMoreNews = useCallback(() => {
        if (hasMorePages && !loading) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            loadNews(nextPage, true);
        }
    }, [hasMorePages, loading, currentPage, loadNews]);

    // Handle scroll to bottom for infinite scroll
    useEffect(() => {
        const handleScroll = () => {
            if (
                window.innerHeight + document.documentElement.scrollTop >=
                document.documentElement.offsetHeight - 1000
            ) {
                loadMoreNews();
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [loadMoreNews]);

    const handleNewsClick = (selectedNewsItem: SduiNews) => {
        setSelectedNews(selectedNewsItem);
    };

    const closeNewsModal = () => {
        setSelectedNews(null);
    };

    // News detail modal
    const NewsModal = selectedNews && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                    onClick={closeNewsModal}
                />
                
                <div className="relative inline-block w-full max-w-4xl transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle">
                    <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {selectedNews.title}
                            </h2>
                            <button
                                onClick={closeNewsModal}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-4">
                                {selectedNews.author && <span>By {selectedNews.author}</span>}
                                <time dateTime={selectedNews.createdAt}>
                                    {new Date(selectedNews.createdAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </time>
                            </div>
                            
                            <div 
                                className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
                                dangerouslySetInnerHTML={{ __html: selectedNews.content }}
                            />
                            
                            {selectedNews.attachments && selectedNews.attachments.length > 0 && (
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                                        Attachments
                                    </h3>
                                    <div className="space-y-2">
                                        {selectedNews.attachments.map((attachment) => (
                                            <a
                                                key={attachment.id}
                                                href={attachment.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                </svg>
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-900 dark:text-white">
                                                        {attachment.name}
                                                    </div>
                                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                                        {attachment.type}
                                                        {attachment.size && ` • ${(attachment.size / 1024 / 1024).toFixed(1)} MB`}
                                                    </div>
                                                </div>
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3 mb-4">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    Unable to load news
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                    {error}
                </p>
                <button
                    onClick={() => {
                        setCurrentPage(1);
                        loadNews(1);
                    }}
                    className="btn-primary"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 sm:pb-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Sdui News
                </h1>
                <button
                    onClick={() => {
                        setCurrentPage(1);
                        loadNews(1);
                    }}
                    disabled={loading}
                    className="btn-secondary text-sm"
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {news.length === 0 && loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                        <span>Loading news...</span>
                    </div>
                </div>
            ) : news.length === 0 ? (
                <div className="text-center py-12">
                    <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-3 mx-auto w-fit mb-4">
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        No news available
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">
                        There are no news articles to display at the moment.
                    </p>
                </div>
            ) : (
                <>
                    <div className="space-y-4">
                        {news.map((newsItem) => (
                            <NewsItem 
                                key={newsItem.id} 
                                news={newsItem} 
                                onNewsClick={handleNewsClick}
                            />
                        ))}
                    </div>
                    
                    {hasMorePages && (
                        <div className="flex justify-center py-6">
                            {loading ? (
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                                    <span>Loading more news...</span>
                                </div>
                            ) : (
                                <button
                                    onClick={loadMoreNews}
                                    className="btn-secondary"
                                >
                                    Load More News
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}
            
            {NewsModal}
        </div>
    );
}