import { memo } from 'react';
import { motion } from 'framer-motion';
import { getAvatarUrl, getInitials } from '../../utils/avatar';

function UserAvatar({
  user,
  size = 40,
  className = '',
  showRing = true,
  onClick,
  animate = false,
}) {
  const px = typeof size === 'number' ? size : 40;
  const url = getAvatarUrl(user?.avatar);
  const initials = getInitials(user?.full_name, user?.username);
  const ring = showRing ? 'ring-2 ring-[#2563EB]/30' : '';

  const inner = url ? (
    <img
      src={url}
      alt=""
      className={`rounded-full object-cover ${ring} ${className}`}
      style={{ width: px, height: px }}
      loading="lazy"
    />
  ) : (
    <span
      className={`rounded-full bg-gradient-to-br from-[#2563EB] to-blue-400 text-white font-bold flex items-center justify-center shrink-0 ${ring} ${className}`}
      style={{ width: px, height: px, fontSize: Math.max(10, px * 0.32) }}
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
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          aria-label="Modifier l'avatar"
        >
          {inner}
        </button>
      </Wrapper>
    );
  }

  return <Wrapper {...motionProps}>{inner}</Wrapper>;
}

export default memo(UserAvatar);
