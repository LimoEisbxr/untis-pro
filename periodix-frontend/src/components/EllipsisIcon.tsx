import type { FC } from 'react';

interface EllipsisIconProps {
    className?: string;
}

const EllipsisIcon: FC<EllipsisIconProps> = ({ className = 'w-2 h-2 text-white' }) => {
    return (
        <svg
            className={className}
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Three dots arranged horizontally */}
            <circle cx="4" cy="10" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="16" cy="10" r="1.5" />
        </svg>
    );
};

export default EllipsisIcon;