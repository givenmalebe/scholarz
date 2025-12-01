import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, User, ArrowRight, Clock, Search } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { db, isFirebaseConfigured } from '../firebase/config';
import { collection, getDocs, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { Blog } from '../types';

export function BlogsPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const cleanup = loadBlogs();
    
    // Return cleanup function for real-time listener
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const loadBlogs = () => {
    if (!isFirebaseConfigured()) {
      setBlogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const blogsRef = collection(db, 'blogs');
    
    // Helper function to process and sort blogs
    const processBlogs = (snapshot: any) => {
      const blogsData: Blog[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        blogsData.push({
          id: doc.id,
          ...data,
          publishedAt: data.publishedAt || data.createdAt,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        } as Blog);
      });
      
      // Sort by publishedAt or createdAt (newest first)
      blogsData.sort((a, b) => {
        const dateA = a.publishedAt || a.createdAt;
        const dateB = b.publishedAt || b.createdAt;
        if (!dateA || !dateB) return 0;
        const timeA = dateA.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime();
        const timeB = dateB.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime();
        return timeB - timeA; // Descending order
      });
      
      setBlogs(blogsData);
      setLoading(false);
    };
    
    // Try different query combinations
    const queries = [
      // Try 1: status + publishedAt (preferred)
      () => query(blogsRef, where('status', '==', 'published'), orderBy('publishedAt', 'desc')),
      // Try 2: status + createdAt (fallback)
      () => query(blogsRef, where('status', '==', 'published'), orderBy('createdAt', 'desc')),
      // Try 3: status only (last resort)
      () => query(blogsRef, where('status', '==', 'published'))
    ];
    
    let unsubscribe: (() => void) | null = null;
    let queryIndex = 0;
    
    const tryQuery = () => {
      if (queryIndex >= queries.length) {
        console.error('All query attempts failed');
        setLoading(false);
        return;
      }
      
      try {
        const q = queries[queryIndex]();
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            processBlogs(snapshot);
          },
          (error) => {
            // If this query fails, try the next one
            console.warn(`Query ${queryIndex + 1} failed, trying next:`, error);
            queryIndex++;
            tryQuery();
          }
        );
      } catch (error) {
        console.warn(`Query ${queryIndex + 1} setup failed, trying next:`, error);
        queryIndex++;
        tryQuery();
      }
    };
    
    tryQuery();
    
    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getExcerpt = (content: string, maxLength: number = 150) => {
    if (!content) return '';
    const text = content.replace(/<[^>]*>/g, ''); // Remove HTML tags
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const filteredBlogs = blogs.filter((blog) => {
    const matchesSearch = 
      blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      blog.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      blog.excerpt?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategory === 'all' || 
      blog.category?.toLowerCase() === selectedCategory.toLowerCase();
    
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(
    new Set(blogs.map(blog => blog.category).filter(Boolean))
  ) as string[];

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Blog</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Insights, updates, and resources from the Scholarz community
            </p>
          </div>

          {/* Search and Filter */}
          <div className="mb-8 space-y-4">
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search blogs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {categories.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Blog List */}
          {filteredBlogs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {blogs.length === 0 
                  ? 'No blogs published yet. Check back soon!'
                  : 'No blogs match your search criteria.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredBlogs.map((blog) => (
                <Link
                  key={blog.id}
                  to={`/blogs/${blog.slug || blog.id}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  {blog.featuredImage && (
                    <div className="aspect-video overflow-hidden bg-gray-200">
                      <img
                        src={blog.featuredImage}
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    {blog.category && (
                      <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full mb-3">
                        {blog.category}
                      </span>
                    )}
                    <h2 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                      {blog.title}
                    </h2>
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {blog.excerpt || getExcerpt(blog.content)}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
                          <span>{blog.authorName}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(blog.publishedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-blue-600 group-hover:text-blue-700 font-medium">
                        Read more
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

