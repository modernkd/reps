import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import './ChromaGrid.css';

export interface ChromaItem {
  image: string;
  images?: string[];
  title: string;
  subtitle: string;
  handle?: string;
  location?: string;
  borderColor?: string;
  gradient?: string;
  url?: string;
  detail?: ReactNode;
  data?: unknown;
}

export interface ChromaGridProps {
  items?: ChromaItem[];
  className?: string;
  radius?: number;
  columns?: number;
  rows?: number;
  damping?: number;
  fadeOut?: number;
  ease?: string;
  onCardClick?: (item: ChromaItem, index: number) => void;
  selectedIndex?: number | null;
}

export const ChromaGrid = ({
  items,
  className = '',
  radius = 300,
  columns = 3,
  rows = 2,
  damping = 0.45,
  fadeOut = 0.6,
  ease = 'power3.out',
  selectedIndex = null,
  onCardClick,
}: ChromaGridProps) => {
  void radius;
  void rows;
  void damping;
  void fadeOut;
  void ease;

  const [imageIndexByCard, setImageIndexByCard] = useState<Record<string, number>>({});

  const demo: ChromaItem[] = [
    {
      image: 'https://i.pravatar.cc/300?img=8',
      title: 'Alex Rivera',
      subtitle: 'Full Stack Developer',
      handle: '@alexrivera',
      borderColor: '#4F46E5',
      gradient: 'linear-gradient(145deg, #4F46E5, #000)',
      url: 'https://github.com/'
    },
    {
      image: 'https://i.pravatar.cc/300?img=11',
      title: 'Jordan Chen',
      subtitle: 'DevOps Engineer',
      handle: '@jordanchen',
      borderColor: '#10B981',
      gradient: 'linear-gradient(210deg, #10B981, #000)',
      url: 'https://linkedin.com/in/'
    },
    {
      image: 'https://i.pravatar.cc/300?img=3',
      title: 'Morgan Blake',
      subtitle: 'UI/UX Designer',
      handle: '@morganblake',
      borderColor: '#F59E0B',
      gradient: 'linear-gradient(165deg, #F59E0B, #000)',
      url: 'https://dribbble.com/'
    },
    {
      image: 'https://i.pravatar.cc/300?img=16',
      title: 'Casey Park',
      subtitle: 'Data Scientist',
      handle: '@caseypark',
      borderColor: '#EF4444',
      gradient: 'linear-gradient(195deg, #EF4444, #000)',
      url: 'https://kaggle.com/'
    },
    {
      image: 'https://i.pravatar.cc/300?img=25',
      title: 'Sam Kim',
      subtitle: 'Mobile Developer',
      handle: '@thesamkim',
      borderColor: '#8B5CF6',
      gradient: 'linear-gradient(225deg, #8B5CF6, #000)',
      url: 'https://github.com/'
    },
    {
      image: 'https://i.pravatar.cc/300?img=60',
      title: 'Tyler Rodriguez',
      subtitle: 'Cloud Architect',
      handle: '@tylerrod',
      borderColor: '#06B6D4',
      gradient: 'linear-gradient(135deg, #06B6D4, #000)',
      url: 'https://aws.amazon.com/'
    }
  ];
  const data = items?.length ? items : demo;

  useEffect(() => {
    setImageIndexByCard((prev) => {
      const next: Record<string, number> = {};
      data.forEach((item, index) => {
        const key = `${item.title}_${index}`;
        next[key] = prev[key] ?? 0;
      });
      return next;
    });
  }, [data]);

  const handleCardClick = (item: ChromaItem, index: number) => {
    if (onCardClick) {
      onCardClick(item, index);
      return;
    }

    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={`chroma-grid ${className}`}
      style={
        {
          '--cols': columns,
        } as CSSProperties
      }
    >
      {data.map((c, i) => {
        const cardKey = `${c.title}_${i}`;
        const availableImages = c.images?.length ? c.images : [c.image];
        const activeImageIndex = imageIndexByCard[cardKey] ?? 0;
        const activeImage = availableImages[activeImageIndex % availableImages.length];
        const canCycleImages = availableImages.length > 1;
        const isClickable = Boolean(c.url || onCardClick);

        return (
        <article
          key={i}
          className={`chroma-card${selectedIndex === i ? ' chroma-card-selected' : ''}`}
          onClick={() => handleCardClick(c, i)}
          onKeyDown={(event) => {
            if (!isClickable) {
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleCardClick(c, i);
            }
          }}
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable ? 0 : -1}
          aria-label={isClickable ? `Open details for ${c.title}` : undefined}
          aria-pressed={isClickable ? selectedIndex === i : undefined}
          style={
            {
              '--card-border': c.borderColor || 'var(--accent-500)',
              cursor: isClickable ? 'pointer' : 'default'
            } as CSSProperties
          }
        >
          <div className="chroma-img-wrapper">
            <button
              type="button"
              className="chroma-img-button"
              onClick={(event) => {
                event.stopPropagation();
                if (!canCycleImages) {
                  return;
                }
                setImageIndexByCard((prev) => ({
                  ...prev,
                  [cardKey]: ((prev[cardKey] ?? 0) + 1) % availableImages.length,
                }));
              }}
              onKeyDown={(event) => {
                if (!canCycleImages) {
                  return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  setImageIndexByCard((prev) => ({
                    ...prev,
                    [cardKey]: ((prev[cardKey] ?? 0) + 1) % availableImages.length,
                  }));
                }
              }}
              aria-label={
                canCycleImages
                  ? `${c.title} image ${activeImageIndex + 1} of ${availableImages.length}`
                  : `${c.title} image`
              }
            >
              <img src={activeImage} alt={c.title} loading="lazy" />
            </button>
            {canCycleImages ? (
              <span className="chroma-image-step">
                {activeImageIndex + 1}/{availableImages.length}
              </span>
            ) : null}
          </div>
          <footer className="chroma-info">
            <h3 className="name">{c.title}</h3>
            {c.handle && <span className="handle">{c.handle}</span>}
            {c.subtitle ? <p className="role">{c.subtitle}</p> : null}
            {c.location && <span className="location">{c.location}</span>}
            {c.detail ? <div className="chroma-detail">{c.detail}</div> : null}
          </footer>
        </article>
        );
      })}
    </div>
  );
};

export default ChromaGrid;
