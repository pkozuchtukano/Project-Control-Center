import React, { useState, useEffect } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { useProjectContext } from '../App';

interface AuthenticatedImageProps {
    src: string;
    alt?: string;
    className?: string;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({ src, alt, className }) => {
    const { settings } = useProjectContext();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchImage = async () => {
            if (!settings?.youtrackBaseUrl || !settings?.youtrackToken) {
                setError(true);
                setIsLoading(false);
                return;
            }

            try {
                // Skompletuj pełny URL, YouTrack często podaje ścieżki względne tj. /api/files/...
                const fullUrl = src.startsWith('http')
                    ? src
                    : `${settings.youtrackBaseUrl.replace(/\/$/, '')}${src.startsWith('/') ? src : `/${src}`}`;

                if (window.electron?.fetchYouTrack) {
                    const data = await window.electron.fetchYouTrack({
                        url: fullUrl,
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${settings.youtrackToken}`,
                            'Accept': 'image/*,*/*'
                        },
                        responseType: 'arraybuffer'
                    });

                    if (isMounted && data) {
                        // Jeśli IPC zwróciło obiekt Buffer: { type: "Buffer", data: [...] } rozpakowujemy go bezpiecznie
                        let bufferData = data;
                        if (data && data.type === 'Buffer' && Array.isArray(data.data)) {
                            bufferData = new Uint8Array(data.data);
                        }

                        const blob = new Blob([bufferData]);
                        const objectUrl = URL.createObjectURL(blob);
                        setImageSrc(objectUrl);
                        setIsLoading(false);
                        return; // Omijamy resztę jeżeli IPC zaciągnął to pomyślnie
                    }
                }

                // Środowisko bez Electrona (bezpośrednia przeglądarka) - polegamy na cookies
                if (isMounted) {
                    setImageSrc(fullUrl);
                    setIsLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    setError(true);
                    setIsLoading(false);
                }
            }
        };

        fetchImage();

        return () => {
            isMounted = false;
            if (imageSrc) {
                URL.revokeObjectURL(imageSrc);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, settings?.youtrackBaseUrl, settings?.youtrackToken]);

    if (error) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-4 border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 ${className || ''}`}>
                <ImageIcon size={24} className="mr-2 opacity-50" />
                <span className="text-xs">Nie można załadować obrazu</span>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8 animate-pulse ${className || ''}`}>
                <Loader2 size={24} className="animate-spin text-indigo-400" />
            </div>
        );
    }

    return (
        <img
            src={imageSrc!}
            alt={alt || "Załącznik YouTrack"}
            className={`max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm my-2 ${className || ''}`}
            loading="lazy"
            onError={() => {
                setError(true);
            }}
        />
    );
};
