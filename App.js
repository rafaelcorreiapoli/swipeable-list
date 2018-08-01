import React, { Component, Fragment } from 'react';
import {Platform, Easing, PanResponder, Dimensions, Animated, Button, TouchableOpacity, FlatList, StyleSheet, Text, View} from 'react-native';

const ANIMATION_DURATION = 300
const CONTACTS = [...Array(30)].map((_, i) => ({
  key: `${i}`,
  name: `Contato ${i}`
}))

const windowWidth = Dimensions.get('window').width
const isAndroid = Platform.OS === 'android'

const GESTURE_FACTOR = 1.5

class ListItem extends React.Component {
  state = {
    dragging: false,
    isDeleting: false,
    pan: new Animated.ValueXY(),
  }
  isDeleting = false

  /**
   * A function that maps the gesture dx to pan.x
   * We are not using nativeDriver here because:
   * https://facebook.github.io/react-native/blog/2017/02/14/using-native-driver-for-animated.html#caveats
   */
  handlePan = Animated.event([
    null,
    { dx: this.state.pan.x },
  ])
  
  constructor(props) {
    super(props)
    this.state.inAndOut = new Animated.Value(props.shouldAnimateOnMount ? 0 : 1)

    this.panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: this.handleMoveShouldSetPanResponder,
      onMoveShouldSetPanResponderCapture: this.handleMoveShouldSetPanResponder,
      onPanResponderGrant: this.handlePanResponderGrant,
      onPanResponderMove: this.handlePanResponderMove,
      onPanResponderRelease: this.handleSwipeRelease,
      onPanResponderTerminate: this.handleSwipeRelease,
      onPanResponderTerminationRequest: this.handleSwipeRelease,
      onShouldBlockNativeResponder: this.handleShouldBlockNativeResponder,
    });
  }
  
  /**
   * Optimization so we don't render all items again when something not related to the items change
   */
  shouldComponentUpdate = (nextProps) => {
    return nextProps.name !== this.props.name || nextProps.id !== this.props.id
  }

  /**
   * Here we decide what is considered a swipe left
   */
  handleMoveShouldSetPanResponder = (ev, gestureState) => {
    return Math.abs(gestureState.dx) > 2 && Math.abs(gestureState.dy) < 6
  }

  /**
   * We have the pan responder
   * Let's notify the list that the swipe has started
   * So it can disable the FlatList's vertical scroll (only necessary on iOS)
   */
  handlePanResponderGrant = (ev, gestureState) => {
    this.setState({
      dragging: true,
    }, this.props.onSwipeStart)
    
  }

  /**
   * The finger is moving... let's animate
   */
  handlePanResponderMove = (ev, gestureState) => {
    this.handlePan(ev, gestureState)
  }

  isDragComplete = (gestureState) => {
    return Math.abs(gestureState.dx * GESTURE_FACTOR) > windowWidth * 0.6;
  }



  handleSwipeRelease = (ev, gestureState) => {    
    const drawerAnimation = Animated.timing(this.state.pan, {
      toValue: { x: 0, y: 0 },
      duration: ANIMATION_DURATION,
      easing: Easing.elastic(0.5),
      useNativeDriver: true,
    })
  
    const outAnimation = Animated.timing(this.state.inAndOut, {
      toValue: 0,
      duration: ANIMATION_DURATION,
      // useNativeDriver: true,
    })

    this.props.onSwipeRelease && this.props.onSwipeRelease()
    drawerAnimation.start()

    if (this.isDragComplete(gestureState)) {
      outAnimation.start(() => this.props.onSwipeComplete(this.props.id))
    }

    this.setState({
      dragging: false,
    })
    
  }

  handleShouldBlockNativeResponder = (evt, gestureState) => true


  /**
   * On componentDidMount, we notify the list that we rendered so it can decide to animate the item
   * when it comes back
   * Also, animate if the item is coming back :)
   */
  componentDidMount() {
    if (this.props.shouldAnimateOnMount) {
      Animated.timing(this.state.inAndOut, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start()
    } else {
      this.props.onMount(this.props.id)
    }
  }

  handlePress = () => {
    this.props.onPress(this.props.id)
  }

  render() {
    const {
      name,
    } = this.props

    /**
     * Animate the height and opacity upon entering (if is coming back) or leaving
     */
    const height = this.state.inAndOut.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 80],
      extrapolate: 'clamp'
    })
    const opacity = this.state.inAndOut.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    })

    /**
     * The background color changes if the user is dragging,
     * so we can give the user a feedback that the item has the pan control
     */
    const backgroundColor = this.state.dragging ? '#a1a1a1' : '#d3d3d3'

    /**
     * The thing that we are dragging must have a translateX equals to the pan.x
     */
    const drawerViewAnimatedStyle = {
      transform: [
        {translateX: this.state.pan.x.interpolate({
          inputRange: [0, windowWidth],
          outputRange: [0, windowWidth * GESTURE_FACTOR]
        })}
      ],
    }

    const wrapperViewStyle = { height, opacity } 
    const listItemViewStyle = [styles.contactWrapper, { backgroundColor }]
    const drawerWrapperViewStyle = [drawerViewAnimatedStyle, styles.deleteView]
    
    return (
      <Animated.View style={wrapperViewStyle}>
        <View style={listItemViewStyle} {...this.panResponder.panHandlers}>
          <TouchableOpacity onPress={this.handlePress}>
            <Text>{name}</Text>
          </TouchableOpacity>
        </View>
        <Animated.View style={drawerWrapperViewStyle} />
      </Animated.View>
      
    )
  }
}
export default class App extends Component {
  state = {
    contacts: CONTACTS,
    // limbo
    deletedContacts: [],
    // are we currently swiping?
    swiping: false,
  }

  // map of items that had already rendered once
  hasRenderedOnce = {}
  // timeouts to complete deletion
  timeouts = {}

  /**
   * Deletion logic
   */
  restoreContact = (deletedContactId) => {
    const timeout = this.timeouts[deletedContactId]
    if (timeout) {
      clearTimeout(timeout)
    }
    this.setState({
      deletedContacts: {
        ...this.state.deletedContacts,
        [deletedContactId]: false,
      }
    })
  }

  /**
   * Deletion logic
   */
  handleDelete = (contactId) => {
    this.setState({
      deletedContacts: {
        ...this.state.deletedContacts,
        [contactId]: true
      }
    })

    this.timeouts[contactId] = setTimeout(() => {
      this.setState({
        contacts: this.state.contacts.filter(contact => contact.key !== contactId),
        deletedContacts: {
          ...this.state.deletedContacts,
          [contactId]: false,
        }
      })
    }, 5000)
  }

  /**
   * Mark this item as something that has already been rendered
   * only items that had already been rendered will animate when entering
   */
  handleListItemMount = (contactId) => {
    this.hasRenderedOnce[contactId] = true
  }

  handlePress = (id) => {
    console.warn(`Press! ${id}`)
  }

  /**
   * This is only called on iOS
   */
  handleSwipeStart = () => {
    this.setState({
      swiping: true,
    })
  }

  /**
   * This is only called on iOS
   */
  handleSwipeRelease = () => {
    this.setState({
      swiping: false,
    })
  }

  handleSwipeComplete = (contactId) => {
    this.handleDelete(contactId)
  }

  /**
   * On Android we don't need to notify the list that the drag started
   * onShouldBlockNativeResponder will take care of disabling Flatlist`s vertical scroll
   */
  swipeHandlers = Platform.select({
    android: {
      onSwipeComplete: this.handleSwipeComplete,
    },
    ios: {
      onSwipeComplete: this.handleSwipeComplete,
      onSwipeStart: this.handleSwipeStart,
      onSwipeRelease: this.handleSwipeRelease,
    }
  })

  /**
   * render the list item
   */
  renderItem = ({ item }) => {
    return (
      <ListItem
        id={item.key}
        name={item.name}
        onDelete={this.handleDelete}
        shouldAnimateOnMount={this.hasRenderedOnce[item.key]}
        onMount={this.handleListItemMount}
        onPress={this.handlePress}
        {...this.swipeHandlers}
      />
    )
  }

  /**
   * render the list separator
   */
  renderSeparator = () => {
    return (
      <View style={styles.separator} />
    );
  }

  /**
   * render
   */
  render() {
    return (
      <View style={styles.container}>
        <FlatList
          style={styles.flatList}
          data={this.state.contacts.filter(contact => !this.state.deletedContacts[contact.key])}
          renderItem={this.renderItem}
          ItemSeparatorComponent={this.renderSeparator}
          ListFooterComponent={this.renderSeparator}
          scrollEnabled={isAndroid || !this.state.swiping}
        />
        {/* <DeletedContacts
          deletedContactsId={this.state.deletedContacts}
          onRestoreContactId={this.restoreContact}
        /> */}
      </View>
    );
  }
}

const DeletedContacts = ({
  deletedContactsId,
  onRestoreContactId
}) => (
  <Fragment>
    {Object.keys(deletedContactsId).filter(x => deletedContactsId[x]).map(deletedContactId => (
      <Button
        key={deletedContactId}
        title={`Restore ${deletedContactId}`}
        onPress={() => onRestoreContactId(deletedContactId)}
      />
    ))}
  </Fragment> 
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
    paddingTop: 22
  },
  deleteView: {
    backgroundColor: '#c0392b',
    width: windowWidth,
    top: 0,
    bottom: 0,
    right: -windowWidth,
    position: 'absolute'
  },
  contactWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#000",
  },
  flatList: {
    backgroundColor: '#c3c3c3',
    flex: 1
  }
});
