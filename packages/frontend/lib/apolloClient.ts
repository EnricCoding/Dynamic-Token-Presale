import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

const SUBGRAPH = process.env.NEXT_PUBLIC_SUBGRAPH_URL ?? '';

const httpLink = new HttpLink({
  uri: SUBGRAPH,
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});
