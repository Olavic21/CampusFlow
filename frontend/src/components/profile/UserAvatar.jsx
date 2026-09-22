import { memo, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getAvatarUrl, getAvatarUrlDirect, getInitials } from '../../utils/avatar';

function UserAvatar({
  user,
  size = 40,
  className = '',
  showRing = true,
  onClick,
  animate = false,
  srcOverride = null,
}) {
  const px = typeof size === 'number' ? size : 40;
  const initials = getInitials(user?.full_name, user?.username);
  const ring = showRing ? 'ring-2 ring-[#2563EB]/30' : '';
  const [imgFailed, setImgFailed] = useState(false);
  const [useDirect, setUseDirect] = useState(false);

  const url = useMemo(() => {
    if (srcOverride) return srcOverride;
    if (!user?.avatar) return null;
    return useDirect
      ? getAvatarUrlDirect(user.avatar)
      : getAvatarUrl(user.avatar);
  }, [user?.avatar, srcOverride, useDirect]);

  useEffect(() => {
    setImgFailed(false);
    setUseDirect(false);
  }, [user?.avatar, srcOverride]);

  const showImage = Boolean(url) && !imgFailed;

  const inner = showImage ? (
    <img
      key={url}
      src={url}
      alt=""
      className={`rounded-full object-cover bg-slate-200 dark:bg-slate-700 ${ring} ${className}`}
      style={{ width: px, height: px, minWidth: px, minHeight: px }}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!srcOverride && user?.avatar && !useDirect) {
          setUseDirect(true);
          return;
        }
        setImgFailed(true);
      }}
    />
  ) : (
    <span
      className={`rounded-full bg-gradient-to-br from-[#2563EB] to-blue-400 text-white font-bold flex items-center justify-center shrink-0 ${ring} ${className}`}
      style={{ width: px, height: px, minWidth: px, minHeight: px, fontSize: Math.max(10, px * 0.32) }}
      aria-hidden
    >
      {initials}
    </span>
  );

  const Wrapper = animate ? motion.div : 'div';
  const motionProps = animate
    ? {
        whileHover: onClick ? { scale: 1.04 } : undefined,
        transition: { type: 'spring', stiffness: 400, damping: 22 },
      }
    : {};

  if (onClick) {
    return (
      <Wrapper {...motionProps}>
        <button
          type="button"
          onClick={onClick}
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] shrink-0"
          aria-label="Modifier l'avatar"
        >
          {inner}
        </button>
      </Wrapper>
    );
  }

  return <Wrapper {...motionProps} className="shrink-0">{inner}</Wrapper>;
}

function propsAreEqual(prev, next) {
  return (
    prev.size === next.size &&
    prev.user?.id === next.user?.id &&
    prev.user?.avatar === next.user?.avatar &&
    prev.srcOverride === next.srcOverride &&
    prev.onClick === next.onClick &&
    prev.animate === next.animate
  );
}

export default memo(UserAvatar, propsAreEqual);
