import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, User, ArrowLeft, Clock } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { db, isFirebaseConfigured } from '../firebase/config';
import { doc, getDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { Blog } from '../types';

export function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadBlog();
    }
  }, [slug]);

  const loadBlog = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!isFirebaseConfigured()) {
        setError('Blog not found');
        setLoading(false);
        return;
      }

      // Try to find blog by slug first, then by ID
      const blogsRef = collection(db, 'blogs');
      let blogDoc = null;

      try {
        // Try slug first - query for published blogs with matching slug
        const slugQuery = query(blogsRef, where('slug', '==', slug), where('status', '==', 'published'));
        const slugSnapshot = await getDocs(slugQuery);
        
        if (!slugSnapshot.empty) {
          blogDoc = slugSnapshot.docs[0];
        }
      } catch (queryError: any) {
        // If query fails (e.g., missing index), try direct document access
        console.warn('Query by slug failed, trying direct access:', queryError);
      }

      // If not found by slug, try ID as fallback
      if (!blogDoc) {
        try {
          const docRef = doc(db, 'blogs', slug);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const blogData = docSnap.data();
            // Only use if published (or if user is admin/author - but we can't check that here)
            if (blogData.status === 'published') {
              blogDoc = docSnap;
            }
          }
        } catch (docError: any) {
          console.warn('Direct document access failed:', docError);
        }
      }

      if (!blogDoc) {
        setError('Blog not found');
        setLoading(false);
        return;
      }

      const data = blogDoc.data();
      const blogData: Blog = {
        id: blogDoc.id,
        ...data,
        publishedAt: data.publishedAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } as Blog;

      setBlog(blogData);

      // Increment view count (only if user is signed in, or skip if permission denied)
      if (blogDoc.ref) {
        try {
          await updateDoc(blogDoc.ref, {
            views: increment(1)
          });
        } catch (viewError: any) {
          // If view update fails due to permissions, it's okay - just log it
          // The blog is still displayed, we just can't track views
          console.warn('Could not update view count:', viewError.message);
        }
      }
    } catch (error) {
      console.error('Error loading blog:', error);
      setError('Failed to load blog');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !blog) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Blog Not Found</h1>
              <p className="text-gray-600 mb-6">{error || 'The blog you are looking for does not exist.'}</p>
              <Link
                to="/blogs"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Blogs
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <Link
            to="/blogs"
            className="inline-flex items-center text-gray-600 hover:text-blue-600 mb-6 md:mb-8 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Blogs</span>
          </Link>

          {/* Blog Content */}
          <article className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
            {blog.featuredImage && (
              <div className="aspect-video overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                <img
                  src={blog.featuredImage}
                  alt={blog.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="p-8 md:p-12 lg:p-16">
              {/* Category Badge */}
              {blog.category && (
                <div className="mb-6">
                  <span className="inline-block px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-full border border-blue-200">
                    {blog.category}
                  </span>
                </div>
              )}
              
              {/* Title */}
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
                {blog.title}
              </h1>

              {/* Meta Information */}
              <div className="flex flex-wrap items-center gap-4 md:gap-6 text-gray-600 mb-10 pb-8 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <span className="font-medium text-gray-700">{blog.authorName || 'Admin'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <Calendar className="w-4 h-4 text-gray-600" />
                  </div>
                  <span>{formatDate(blog.publishedAt || blog.createdAt)}</span>
                </div>
                {blog.views !== undefined && (
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <Clock className="w-4 h-4 text-gray-600" />
                    </div>
                    <span>{blog.views} {blog.views === 1 ? 'view' : 'views'}</span>
                  </div>
                )}
              </div>

              {/* Blog Content */}
              <div 
                className="blog-content max-w-none"
                dangerouslySetInnerHTML={{ __html: blog.content }}
              />
              
              {/* Enhanced Styling */}
              <style>{`
                .blog-content {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                  color: #374151;
                  line-height: 1.85;
                  font-size: 1.125rem;
                }
                
                .blog-content p {
                  margin-bottom: 1.75rem;
                  line-height: 1.9;
                  color: #4b5563;
                  font-size: 1.125rem;
                }
                
                .blog-content p:first-of-type {
                  font-size: 1.25rem;
                  color: #1f2937;
                  font-weight: 500;
                  margin-bottom: 2rem;
                  line-height: 1.8;
                }
                
                .blog-content h2 {
                  margin-top: 3rem;
                  margin-bottom: 1.5rem;
                  font-size: 2rem;
                  font-weight: 700;
                  color: #111827;
                  line-height: 1.3;
                  letter-spacing: -0.02em;
                }
                
                .blog-content h2:first-of-type {
                  margin-top: 2rem;
                }
                
                .blog-content h3 {
                  margin-top: 2.5rem;
                  margin-bottom: 1rem;
                  font-size: 1.5rem;
                  font-weight: 600;
                  color: #1f2937;
                  line-height: 1.4;
                }
                
                .blog-content h4 {
                  margin-top: 2rem;
                  margin-bottom: 0.75rem;
                  font-size: 1.25rem;
                  font-weight: 600;
                  color: #374151;
                }
                
                .blog-content a {
                  color: #2563eb;
                  text-decoration: underline;
                  text-underline-offset: 3px;
                  font-weight: 600;
                  transition: all 0.2s ease;
                }
                
                .blog-content a:hover {
                  color: #1d4ed8;
                  text-decoration-thickness: 2px;
                }
                
                .blog-content strong {
                  font-weight: 700;
                  color: #111827;
                }
                
                .blog-content em {
                  font-style: italic;
                  color: #4b5563;
                }
                
                .blog-content ul, .blog-content ol {
                  margin: 2rem 0;
                  padding-left: 2rem;
                }
                
                .blog-content ul {
                  list-style-type: disc;
                }
                
                .blog-content ol {
                  list-style-type: decimal;
                }
                
                .blog-content li {
                  margin-bottom: 0.75rem;
                  line-height: 1.8;
                  color: #4b5563;
                  font-size: 1.125rem;
                }
                
                .blog-content li::marker {
                  color: #2563eb;
                  font-weight: 600;
                }
                
                .blog-content blockquote {
                  margin: 2rem 0;
                  padding: 1.5rem 2rem;
                  border-left: 4px solid #2563eb;
                  background-color: #f3f4f6;
                  border-radius: 0.5rem;
                  font-style: italic;
                  color: #4b5563;
                }
                
                .blog-content blockquote p {
                  margin-bottom: 0;
                }
                
                .blog-content code {
                  display: none;
                }
                
                .blog-content pre {
                  display: none;
                }
                
                .blog-content img {
                  margin: 2.5rem auto;
                  border-radius: 0.75rem;
                  max-width: 100%;
                  height: auto;
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                
                .blog-content hr {
                  margin: 3rem 0;
                  border: none;
                  border-top: 2px solid #e5e7eb;
                }
              `}</style>

              {/* Tags */}
              {blog.tags && blog.tags.length > 0 && (
                <div className="mt-12 pt-8 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {blog.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors cursor-default"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Share Section */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Enjoyed this article?</h3>
                    <p className="text-sm text-gray-600">Share it with others who might find it valuable.</p>
                  </div>
                  <Link
                    to="/blogs"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg whitespace-nowrap"
                  >
                    Explore More Blogs
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </Layout>
  );
}

