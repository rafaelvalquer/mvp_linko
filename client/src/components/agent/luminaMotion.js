export const luminaDurations = {
  micro: 0.16,
  base: 0.24,
  panel: 0.34,
  slow: 0.48,
};

export const luminaSprings = {
  soft: { type: "spring", stiffness: 280, damping: 24 },
  panel: { type: "spring", stiffness: 220, damping: 26 },
  chip: { type: "spring", stiffness: 340, damping: 28 },
};

export const luminaEasings = {
  standard: [0.22, 1, 0.36, 1],
  soft: [0.16, 1, 0.3, 1],
  crisp: [0.2, 0.9, 0.2, 1],
};

function reducedState(visible = {}) {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, ...visible },
    exit: { opacity: 0 },
  };
}

function reducedTransition() {
  return { duration: 0.12 };
}

function buildDrawerVariants({ reducedMotion = false, isMobile = false }) {
  if (reducedMotion) return reducedState();

  return {
    hidden: isMobile ? { opacity: 0, y: 24 } : { opacity: 0, x: 28, scale: 0.985 },
    visible: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: isMobile ? { opacity: 0, y: 18 } : { opacity: 0, x: 24, scale: 0.992 },
  };
}

export function getLuminaMotionPreset({
  reducedMotion = false,
  isMobile = false,
} = {}) {
  return {
    launcherVariants: reducedMotion
      ? reducedState()
      : {
          hidden: { opacity: 0, y: 16, scale: 0.96 },
          visible: { opacity: 1, y: 0, scale: 1 },
        },
    launcherGlowVariants: reducedMotion
      ? {
          idle: { opacity: 0.14, scale: 1 },
          open: { opacity: 0, scale: 0.96 },
        }
      : {
          idle: {
            opacity: [0.18, 0.34, 0.18],
            scale: [0.96, 1.04, 0.96],
          },
          open: { opacity: 0, scale: 0.96 },
        },
    overlayVariants: reducedMotion
      ? reducedState()
      : {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
          exit: { opacity: 0 },
        },
    drawerVariants: buildDrawerVariants({ reducedMotion, isMobile }),
    headerVariants: {
      container: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: -10 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                delayChildren: 0.05,
                staggerChildren: 0.05,
              },
            },
          },
      item: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: -8 },
            visible: { opacity: 1, y: 0 },
          },
    },
    contentOverlayBackdropVariants: reducedMotion
      ? reducedState()
      : {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
          exit: { opacity: 0 },
        },
    floatingPanelVariants: reducedMotion
      ? reducedState()
      : {
          hidden: { opacity: 0, y: 10, scale: 0.99 },
          visible: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -8, scale: 0.992 },
        },
    sheetPanelVariants: reducedMotion
      ? reducedState()
      : {
          hidden: { opacity: 0, y: 28 },
          visible: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 20 },
        },
    overlayPanelHeaderVariants: {
      container: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: -8 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                delayChildren: 0.03,
                staggerChildren: 0.04,
              },
            },
          },
      item: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: -6 },
            visible: { opacity: 1, y: 0 },
          },
    },
    recentSessionsVariants: {
      container: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: 6 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                delayChildren: 0.04,
                staggerChildren: 0.04,
              },
            },
          },
      item: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: 8, scale: 0.985 },
            visible: { opacity: 1, y: 0, scale: 1 },
          },
    },
    recentSessionItemVariants: reducedMotion
      ? {
          hidden: { opacity: 0 },
          visible: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0 },
          idle: { scale: 1, y: 0 },
          hover: { scale: 1, y: 0 },
          tap: { scale: 1 },
        }
      : {
          hidden: { opacity: 0, y: 8, scale: 0.985 },
          visible: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -6, scale: 0.99 },
          idle: { scale: 1, y: 0 },
          hover: { scale: 1.015, y: -2 },
          tap: { scale: 0.985 },
        },
    actionMenuVariants: {
      container: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0 },
          },
    },
    actionMenuBodyVariants: reducedMotion
      ? {
          hidden: { opacity: 0, height: 0 },
          visible: { opacity: 1, height: "auto" },
          exit: { opacity: 0, height: 0 },
        }
      : {
          hidden: { opacity: 0, height: 0, y: -8 },
          visible: { opacity: 1, height: "auto", y: 0 },
          exit: { opacity: 0, height: 0, y: -6 },
        },
    categoryTabsVariants: {
      container: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                delayChildren: 0.02,
                staggerChildren: 0.03,
              },
            },
          },
      item: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: 6 },
            visible: { opacity: 1, y: 0 },
          },
    },
    categoryTabVariants: reducedMotion
      ? {
          hidden: { opacity: 0 },
          visible: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0 },
          idle: { scale: 1, y: 0 },
          hover: { scale: 1, y: 0 },
          tap: { scale: 1 },
        }
      : {
          hidden: { opacity: 0, y: 6 },
          visible: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -4 },
          idle: { scale: 1, y: 0 },
          hover: { scale: 1.02, y: -1 },
          tap: { scale: 0.985 },
        },
    actionGridVariants: {
      container: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                delayChildren: 0.03,
                staggerChildren: 0.04,
              },
            },
          },
      item: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: 10, scale: 0.99 },
            visible: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: -6, scale: 0.99 },
          },
    },
    actionCardVariants: reducedMotion
      ? {
          hidden: { opacity: 0 },
          visible: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0 },
          idle: { scale: 1, y: 0 },
          hover: { scale: 1, y: 0 },
          tap: { scale: 1 },
        }
      : {
          hidden: { opacity: 0, y: 10, scale: 0.99 },
          visible: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -6, scale: 0.99 },
          idle: { scale: 1, y: 0 },
          hover: { scale: 1.012, y: -2 },
          tap: { scale: 0.988 },
        },
    welcomeCardVariants: reducedMotion
      ? reducedState()
      : {
          hidden: { opacity: 0, y: 14, scale: 0.992 },
          visible: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -10, scale: 0.992 },
        },
    messageListVariants: {
      container: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.03,
              },
            },
          },
    },
    assistantBubbleVariants: reducedMotion
      ? reducedState()
      : {
          hidden: { opacity: 0, x: -18, y: 8 },
          visible: { opacity: 1, x: 0, y: 0 },
          exit: { opacity: 0, x: -12, y: -4 },
        },
    userBubbleVariants: reducedMotion
      ? reducedState()
      : {
          hidden: { opacity: 0, x: 18, y: 8 },
          visible: { opacity: 1, x: 0, y: 0 },
          exit: { opacity: 0, x: 12, y: -4 },
        },
    typingBubbleVariants: reducedMotion
      ? reducedState()
      : {
          hidden: { opacity: 0, x: -14, y: 8 },
          visible: { opacity: 1, x: 0, y: 0 },
          exit: { opacity: 0, x: -10, y: -4 },
        },
    quickRepliesVariants: {
      container: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: 8 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                delayChildren: 0.02,
                staggerChildren: 0.03,
              },
            },
            exit: { opacity: 0, y: -6 },
          },
      item: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: 6, scale: 0.985 },
            visible: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: -4, scale: 0.985 },
          },
    },
    quickReplyVariants: reducedMotion
      ? {
          hidden: { opacity: 0 },
          visible: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0 },
          idle: { scale: 1, y: 0 },
          hover: { scale: 1, y: 0 },
          tap: { scale: 1 },
        }
      : {
          hidden: { opacity: 0, y: 6, scale: 0.985 },
          visible: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -4, scale: 0.985 },
          idle: { scale: 1, y: 0 },
          hover: { scale: 1.015, y: -1 },
          tap: { scale: 0.985 },
        },
    composerVariants: {
      container: reducedMotion
        ? reducedState()
        : {
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0 },
          },
      inputShell: reducedMotion
        ? {
            idle: { scale: 1 },
            focus: { scale: 1 },
          }
        : {
            idle: {
              scale: 1,
              boxShadow: "0 0 0 0 rgba(34,211,238,0)",
            },
            focus: {
              scale: 1.003,
              boxShadow: "0 0 0 3px rgba(34,211,238,0.16)",
            },
          },
    },
    sendButtonVariants: reducedMotion
      ? {
          idle: { scale: 1, y: 0 },
          hover: { scale: 1, y: 0 },
          tap: { scale: 1 },
        }
      : {
          idle: { scale: 1, y: 0 },
          hover: { scale: 1.03, y: -2 },
          tap: { scale: 0.97 },
        },
    attentionCtaVariants: reducedMotion
      ? {
          idle: {
            scale: 1,
            y: 0,
            boxShadow: "0 0 0 0 rgba(34,211,238,0)",
          },
          highlighted: {
            scale: 1,
            y: 0,
            boxShadow: "0 0 0 1px rgba(34,211,238,0.18)",
          },
        }
      : {
          idle: {
            scale: 1,
            y: 0,
            boxShadow: "0 0 0 0 rgba(34,211,238,0)",
          },
          highlighted: {
            scale: [1, 1.018, 1],
            y: [0, -1, 0],
            boxShadow: [
              "0 0 0 0 rgba(34,211,238,0)",
              "0 10px 28px -18px rgba(34,211,238,0.55)",
              "0 0 0 0 rgba(34,211,238,0)",
            ],
          },
        },
    attentionGlowVariants: reducedMotion
      ? {
          idle: { opacity: 0, scale: 0.96 },
          highlighted: { opacity: 0.22, scale: 1 },
        }
      : {
          idle: { opacity: 0, scale: 0.96 },
          highlighted: {
            opacity: [0.12, 0.28, 0.12],
            scale: [0.98, 1.04, 0.98],
          },
        },
    transitions: {
      micro: reducedMotion ? reducedTransition() : { duration: luminaDurations.micro, ease: luminaEasings.soft },
      base: reducedMotion ? reducedTransition() : { duration: luminaDurations.base, ease: luminaEasings.standard },
      panel: reducedMotion ? reducedTransition() : luminaSprings.panel,
      chip: reducedMotion ? reducedTransition() : luminaSprings.chip,
      soft: reducedMotion ? reducedTransition() : luminaSprings.soft,
      attention: reducedMotion
        ? { duration: 0.12 }
        : {
            duration: luminaDurations.slow + 0.24,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          },
      glow: reducedMotion
        ? { duration: 0.12 }
        : {
            duration: luminaDurations.slow,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "mirror",
            ease: "easeInOut",
          },
      typing: reducedMotion
        ? { duration: 0.12 }
        : {
            duration: 0.8,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          },
    },
  };
}
