import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  MessageCircle,
  Image as ImageIcon,
  X,
  Send,
  Trash2,
  Smile,
} from 'lucide-react';
import { db } from '../../firebase';
import type {
  FeedComment,
  FeedPost,
  FeedReactionEmoji,
  UserAccount,
  UserProfile,
} from '../../types';
import { FEED_REACTIONS } from '../../types';
import { Avatar } from '../../components/Avatar';
import { validateImageFile, uploadFeedImage } from '../../lib/storage';
import { cn } from '../../lib/utils';
import { OperationType, handleFirestoreError } from '../../lib/firestoreError';

interface FeedViewProps {
  familyId: string | undefined;
  posts: FeedPost[];
  loading: boolean;
  userAccount: UserAccount | null;
  profile: UserProfile;
  showAlert: (title: string, message: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function FeedView({
  familyId,
  posts,
  loading,
  userAccount,
  profile,
  showAlert,
}: FeedViewProps) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  if (!familyId || !userAccount) {
    return (
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
        <p className="text-slate-400 font-bold">가족 피드는 로그인 후 사용할 수 있어요</p>
      </div>
    );
  }

  const activePost = activePostId ? posts.find((p) => p.id === activePostId) ?? null : null;

  return (
    <div className="space-y-5 lg:h-full lg:flex lg:flex-col lg:min-h-0 lg:space-y-4">
      <div className="flex items-center justify-between lg:shrink-0">
        <div>
          <h2 className="font-black text-2xl text-slate-800">가족 피드</h2>
          <p className="text-xs font-bold text-slate-400 mt-0.5">
            가족 모두와 나누는 소중한 순간
          </p>
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="bg-gradient-to-br from-pink-500 to-rose-500 text-white font-black px-4 py-2.5 rounded-2xl text-xs shadow-lg shadow-pink-100 active:scale-95 transition-all flex items-center gap-1.5"
        >
          <ImageIcon size={14} />
          새 게시물
        </button>
      </div>

      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto scrollbar-hide lg:pr-1 space-y-5 lg:space-y-4">
      {loading && posts.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center">
          <p className="text-slate-400 text-sm font-medium">피드를 불러오는 중...</p>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-2">
          <div className="text-4xl">📸</div>
          <p className="text-slate-500 font-bold text-sm">아직 게시물이 없어요</p>
          <p className="text-slate-400 text-[11px] font-medium">
            첫 번째 가족 이야기를 남겨보세요!
          </p>
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUid={userAccount.uid}
            familyId={familyId}
            onOpenComments={() => setActivePostId(post.id)}
            showAlert={showAlert}
          />
        ))}
      </div>
      </div>

      <AnimatePresence>
        {composeOpen && (
          <ComposePostModal
            onClose={() => setComposeOpen(false)}
            familyId={familyId}
            userAccount={userAccount}
            profile={profile}
            showAlert={showAlert}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activePost && (
          <CommentsSheet
            post={activePost}
            familyId={familyId}
            userAccount={userAccount}
            profile={profile}
            onClose={() => setActivePostId(null)}
            showAlert={showAlert}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// PostCard
// ============================================================

interface PostCardProps {
  post: FeedPost;
  currentUid: string;
  familyId: string;
  onOpenComments: () => void;
  showAlert: (t: string, m: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUid,
  familyId,
  onOpenComments,
  showAlert,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const myReaction = post.reactions?.[currentUid];
  const reactionEntries = Object.entries(post.reactions ?? {});
  const reactionCount = reactionEntries.length;

  // Build a quick summary: top 3 distinct emojis
  const topEmojis = Array.from(
    new Set(reactionEntries.map(([, e]) => e))
  ).slice(0, 3);

  const react = async (emoji: FeedReactionEmoji) => {
    setPickerOpen(false);
    try {
      const ref = doc(db, 'families', familyId, 'feed', post.id);
      const nextReactions = { ...(post.reactions ?? {}) };
      if (nextReactions[currentUid] === emoji) {
        delete nextReactions[currentUid];
      } else {
        nextReactions[currentUid] = emoji;
      }
      await updateDoc(ref, { reactions: nextReactions });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `families/${familyId}/feed/${post.id}`);
    }
  };

  const handleDelete = async () => {
    if (post.authorUid !== currentUid) return;
    if (!confirm('이 게시물을 삭제할까요? 댓글도 함께 사라져요.')) return;
    try {
      await deleteDoc(doc(db, 'families', familyId, 'feed', post.id));
    } catch (err) {
      showAlert('삭제 실패', '게시물을 삭제하지 못했어요.');
      handleFirestoreError(err, OperationType.DELETE, `families/${familyId}/feed/${post.id}`);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar
          emoji={post.authorAvatar}
          url={post.authorAvatarUrl}
          size={40}
          className="rounded-full"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-black text-sm text-slate-800 truncate">
              {post.authorName}
            </p>
            <span
              className={cn(
                'text-[9px] font-black px-1.5 py-0.5 rounded',
                post.authorRole === 'parent'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-yellow-100 text-yellow-700'
              )}
            >
              {post.authorRole === 'parent' ? '부모' : '자녀'}
            </span>
          </div>
          <p className="text-[10px] font-bold text-slate-400">{timeAgo(post.createdAt)}</p>
        </div>
        {post.authorUid === currentUid && (
          <button
            onClick={handleDelete}
            className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center"
            aria-label="삭제"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Image */}
      {post.imageUrl && (
        <div className="bg-slate-100">
          <img
            src={post.imageUrl}
            alt=""
            className="w-full max-h-[480px] object-cover"
          />
        </div>
      )}

      {/* Text */}
      {post.text && (
        <div className="px-4 pt-3">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {post.text}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-3 relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-all',
            myReaction
              ? 'bg-pink-50 text-pink-600'
              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
          )}
        >
          {myReaction ? <span className="text-sm">{myReaction}</span> : <Heart size={14} />}
          <span>{reactionCount > 0 ? reactionCount : '반응'}</span>
        </button>

        <button
          onClick={onOpenComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all"
        >
          <MessageCircle size={14} />
          <span>댓글{post.commentCount ? ` ${post.commentCount}` : ''}</span>
        </button>

        {topEmojis.length > 0 && (
          <div className="ml-auto flex items-center gap-0.5">
            {topEmojis.map((e) => (
              <span key={e} className="text-sm">
                {e}
              </span>
            ))}
          </div>
        )}

        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              className="absolute bottom-full left-2 mb-1 bg-white shadow-xl rounded-full border border-slate-100 p-1.5 flex gap-1 z-10"
            >
              {FEED_REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => react(e)}
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all active:scale-90 hover:bg-slate-100',
                    myReaction === e && 'bg-pink-100'
                  )}
                >
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ============================================================
// Compose modal
// ============================================================

function ComposePostModal({
  onClose,
  familyId,
  userAccount,
  profile,
  showAlert,
}: {
  onClose: () => void;
  familyId: string;
  userAccount: UserAccount;
  profile: UserProfile;
  showAlert: (t: string, m: string) => void;
}) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const err = validateImageFile(f);
    if (err) {
      showAlert('사진 오류', err);
      return;
    }
    setFile(f);
  };

  const canSubmit = (text.trim().length > 0 || !!file) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      let imageUrl: string | undefined;
      if (file) {
        imageUrl = await uploadFeedImage(familyId, file);
      }
      await addDoc(collection(db, 'families', familyId, 'feed'), {
        authorUid: userAccount.uid,
        authorName: profile.name || userAccount.name || '가족',
        authorAvatar: profile.avatar || '🦁',
        authorAvatarUrl: profile.avatarUrl || null,
        authorRole: userAccount.role,
        text: text.trim(),
        imageUrl: imageUrl || null,
        createdAt: new Date().toISOString(),
        reactions: {},
        commentCount: 0,
      });
      onClose();
    } catch (err: any) {
      showAlert('게시 실패', err?.message || '게시물을 올리지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#FDFCF0] rounded-t-[2rem] shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X size={16} />
          </button>
          <h3 className="font-black text-slate-800">새 게시물</h3>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={cn(
              'px-4 py-1.5 rounded-xl text-xs font-black transition-all',
              canSubmit
                ? 'bg-slate-900 text-white active:scale-95'
                : 'bg-slate-200 text-slate-400'
            )}
          >
            {busy ? '올리는 중...' : '게시'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar emoji={profile.avatar} url={profile.avatarUrl} size={40} className="rounded-full" />
            <div>
              <p className="font-black text-sm text-slate-800">{profile.name}</p>
              <p className="text-[10px] font-bold text-slate-400">
                {userAccount.role === 'parent' ? '부모' : '자녀'}로 게시
              </p>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="오늘 가족에게 나누고 싶은 이야기를 적어보세요..."
            rows={5}
            className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-yellow-400 bg-white font-medium text-sm resize-none"
          />

          {preview && (
            <div className="relative rounded-2xl overflow-hidden bg-slate-100">
              <img src={preview} alt="" className="w-full max-h-72 object-cover" />
              <button
                onClick={() => setFile(null)}
                className="absolute top-2 right-2 w-8 h-8 bg-slate-900/70 text-white rounded-full flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <label className="flex items-center justify-center gap-2 w-full py-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors">
            <ImageIcon size={16} />
            <span className="text-xs font-bold">사진 추가</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFile}
              className="hidden"
            />
          </label>
        </div>
      </motion.div>
    </>
  );
}

// ============================================================
// Comments sheet
// ============================================================

function CommentsSheet({
  post,
  familyId,
  userAccount,
  profile,
  onClose,
  showAlert,
}: {
  post: FeedPost;
  familyId: string;
  userAccount: UserAccount;
  profile: UserProfile;
  onClose: () => void;
  showAlert: (t: string, m: string) => void;
}) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'families', familyId, 'feed', post.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedComment)));
    });
    return () => unsub();
  }, [familyId, post.id]);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const commentRef = doc(collection(db, 'families', familyId, 'feed', post.id, 'comments'));
      await setDoc(commentRef, {
        authorUid: userAccount.uid,
        authorName: profile.name || userAccount.name || '가족',
        authorAvatar: profile.avatar || '🦁',
        authorAvatarUrl: profile.avatarUrl || null,
        authorRole: userAccount.role,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      });
      // increment commentCount on the post
      try {
        await updateDoc(doc(db, 'families', familyId, 'feed', post.id), {
          commentCount: increment(1),
          lastCommentAt: serverTimestamp(),
        });
      } catch {}
      setText('');
    } catch (err: any) {
      showAlert('댓글 실패', err?.message || '댓글을 남기지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#FDFCF0] rounded-t-[2rem] shadow-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="w-8" />
          <h3 className="font-black text-slate-800">댓글</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {comments.length === 0 && (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-slate-400 text-xs font-bold">
                첫 댓글을 남겨보세요!
              </p>
            </div>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-3">
              <Avatar
                emoji={c.authorAvatar}
                url={c.authorAvatarUrl}
                size={32}
                className="rounded-full mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 border border-slate-100">
                  <p className="text-[11px] font-black text-slate-700">{c.authorName}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {c.text}
                  </p>
                </div>
                <p className="text-[9px] font-bold text-slate-400 mt-1 ml-3">
                  {timeAgo(c.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 px-4 py-3 flex items-center gap-2 bg-white">
          <Avatar emoji={profile.avatar} url={profile.avatarUrl} size={32} className="rounded-full" />
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="따뜻한 댓글을 남겨주세요..."
            className="flex-1 bg-slate-50 rounded-full px-4 py-2 text-sm outline-none border border-slate-100 focus:border-yellow-300"
          />
          <button
            onClick={submit}
            disabled={!text.trim() || busy}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center transition-all',
              text.trim() && !busy
                ? 'bg-slate-900 text-white active:scale-90'
                : 'bg-slate-200 text-slate-400'
            )}
          >
            <Send size={14} />
          </button>
        </div>
      </motion.div>
    </>
  );
}

// Small unused helper kept for future emoji-picker expansion
export const _FeedIconExports = { Smile };
