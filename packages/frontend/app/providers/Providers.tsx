'use client';

import React from 'react';
import type { ReactNode } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { ApolloProvider } from '@apollo/client/react';

import { queryClient } from '@/lib/queryClient';
import { wagmiConfig } from '@/lib/wagmi';
import { apolloClient } from '@/lib/apolloClient';

import '@rainbow-me/rainbowkit/styles.css';

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiConfig}>
                <RainbowKitProvider theme={darkTheme()}>
                    <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
                </RainbowKitProvider>
            </WagmiProvider>
        </QueryClientProvider>
    );
}
