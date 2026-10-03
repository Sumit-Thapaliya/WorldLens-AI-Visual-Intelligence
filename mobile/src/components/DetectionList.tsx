/**
 * DetectionList - Scrollable list of currently detected/tracked objects with counts.
 */

import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { ObjectCount, TrackedObject } from '../types/Detection';
import { formatConfidence, getConfidenceColor } from '../utils/confidence';
import { estimateSpatialInfo } from '../utils/spatial';

interface DetectionListProps {
  counts: ObjectCount[];
  trackedObjects: TrackedObject[];
  onObjectPress?: (obj: TrackedObject) => void;
  maxItems?: number;
}

export const DetectionList: React.FC<DetectionListProps> = ({
  counts,
  trackedObjects,
  maxItems = 8,
}) => {
  const active = trackedObjects
    .filter((t) => t.isActive && t.framesSinceSeen <= 2)
    .slice(0, maxItems);

  return (
    <View style={styles.container}>
      {/* Count summary */}
      {counts.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.countRow}
          contentContainerStyle={styles.countRowContent}
        >
          {counts.slice(0, 10).map((c) => (
            <View key={c.label} style={styles.countPill}>
              <Text style={styles.countNumber}>{c.count}</Text>
              <Text style={styles.countLabel}>{c.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Detailed list */}
      {active.length > 0 && (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {active.map((obj) => {
            const spatial = estimateSpatialInfo(obj.boundingBox);
            return (
              <View key={obj.trackingId} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <View
                    style={[
                      styles.confidenceDot,
                      { backgroundColor: getConfidenceColor(obj.confidence) },
                    ]}
                  />
                  <Text style={styles.itemLabel}>
                    {obj.label} #{obj.trackingId}
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.itemMeta}>{formatConfidence(obj.confidence)}</Text>
                  <Text style={styles.itemMeta}>
                    {spatial.horizontalPosition} · {spatial.distance}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {counts.length === 0 && active.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Point camera at objects to begin detection</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  countRow: {
    maxHeight: 50,
  },
  countRowContent: {
    paddingHorizontal: 4,
    gap: 8,
    alignItems: 'center',
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  countNumber: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '800',
  },
  countLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  list: {
    marginTop: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    marginBottom: 6,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  itemMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
});
