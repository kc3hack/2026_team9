"use client";

import {
  Badge,
  Box,
  Button,
  Container,
  Heading,
  HStack,
  List,
  Stack,
  Text,
} from "@chakra-ui/react";

const sampleSubtasks = [
  "要件を 3 行以内で明文化する",
  "必要なデータと入出力を定義する",
  "実装タスクを 30 分単位で分割する",
  "検証手順を先に決める",
];

export default function Home() {
  return (
    <Box
      minH="100dvh"
      bgGradient="linear(to-b, teal.50, cyan.50)"
      px={{ base: 4, md: 8 }}
      py={{ base: 8, md: 12 }}
    >
      <Container maxW="3xl">
        <Stack gap={6}>
          <HStack gap={3}>
            <Badge colorPalette="teal" size="md">
              Chakra UI v3
            </Badge>
            <Badge colorPalette="cyan" size="md">
              Hackathon
            </Badge>
          </HStack>

          <Stack gap={3}>
            <Heading size="2xl" lineHeight="1.15">
              タスク細分化ツール
            </Heading>
            <Text fontSize="lg" color="fg.muted">
              曖昧なタスクを、すぐに着手できる具体的なサブタスクへ分解します。
            </Text>
          </Stack>

          <Box bg="white" borderWidth="1px" borderRadius="2xl" p={{ base: 5, md: 7 }}>
            <Stack gap={4}>
              <Text fontWeight="semibold">サンプル出力</Text>
              <List.Root gap={2}>
                {sampleSubtasks.map((step) => (
                  <List.Item key={step}>{step}</List.Item>
                ))}
              </List.Root>
              <HStack gap={3}>
                <Button colorPalette="teal">分解を実行</Button>
                <Button variant="outline">履歴を見る</Button>
              </HStack>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
