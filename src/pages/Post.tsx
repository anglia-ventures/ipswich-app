import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { canRead, getPostBySlug } from "../api/ghost";
import type { Post } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import Paywall from "../components/Paywall";

export default function PostPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { member } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPostBySlug(slug)
      .then((p) => {
        if (!cancelled) setPost(p);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) return <p className="status">Loading…</p>;
  if (error) return <p className="status error">{error}</p>;
  if (!post) return <p className="status">Article not found.</p>;

  const allowed = canRead(post, member);

  return (
    <article className="post">
      <header className="post-header">
        <h1>{post.title}</h1>
        <div className="post-meta">
          {post.primary_author && <span>{post.primary_author.name}</span>}
          <time dateTime={post.published_at}>
            {new Date(post.published_at).toLocaleDateString()}
          </time>
          <span>{post.reading_time} min read</span>
        </div>
        {post.feature_image && (
          <figure className="post-feature">
            <img src={post.feature_image} alt={post.feature_image_alt ?? ""} />
            {post.feature_image_caption && (
              <figcaption
                dangerouslySetInnerHTML={{ __html: post.feature_image_caption }}
              />
            )}
          </figure>
        )}
      </header>

      {allowed && post.html ? (
        <div className="post-content" dangerouslySetInnerHTML={{ __html: post.html }} />
      ) : (
        <>
          {(post.custom_excerpt || post.excerpt) && (
            <p className="post-lead">{post.custom_excerpt || post.excerpt}</p>
          )}
          {post.visibility !== "public" && (
            <Paywall visibility={post.visibility as "members" | "paid" | "tiers"} />
          )}
        </>
      )}
    </article>
  );
}
