import React, { Component } from 'react';
import {PanResponder, Dimensions, Animated, Button, TouchableOpacity, FlatList, StyleSheet, Text, View} from 'react-native';

const ANIMATION_DURATION = 300
const CONTACTS = [{
  key: 'c1',
  name: 'contact1'
}, {
  key: 'c2',
  name: 'contact2'
}, {
  key: 'c3',
  name: 'contact3'
}, {
  key: 'c4',
  name: 'contact4'
}, {
  key: 'c5',
  name: 'contact5'
}, {
  key: 'c6',
  name: 'contact6'
}, {
  key: 'c7',
  name: 'contact7'
}]

const windowWidth = Dimensions.get('window').width

class ListItem extends React.Component {
  state = {
    dragging: false,
    isDeleting: false,
  }
  isDeleting = false

  constructor(props) {
    super(props)
    this.pan =  new Animated.ValueXY(),
    this.inAndOut = new Animated.Value(props.shouldAnimateOnMount ? 0 : 1)

    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => true,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => true,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,
      onPanResponderGrant: (evt, gestureState) => {
        this.setState({
          dragging: true,
        })
      },
      onPanResponderMove: Animated.event([
        null,
        {dx: this.pan.x}
      ], {
        listener: (event, gesture) => {
          if (Math.abs(gesture.dx) > 200 && !this.isDeleting) {
            this.handleDeletePress()
          }
        }
      }),
      onPanResponderTerminationRequest: (evt, gestureState) => true,
      onPanResponderRelease: (evt, gestureState) => {
        this.setState({
          dragging: false,
        })
        Animated.timing(this.pan, {
          toValue: { x: 0, y: 0 },
          duration: ANIMATION_DURATION
        }).start();
      },
      onPanResponderTerminate: (evt, gestureState) => {
        this.setState({
          dragging: false,
        })
      },
      onShouldBlockNativeResponder: (evt, gestureState) => {
        return true;
      },
    });
  }

  componentDidMount() {
    if (this.props.shouldAnimateOnMount) {
      Animated.timing(this.inAndOut, {
        toValue: 1,
        duration: ANIMATION_DURATION
      }).start()  
    }
    this.props.onMount()
  }

  handleDeletePress = () => {
    if (!this.isDeleting) {
      Animated.timing(this.inAndOut, {
        toValue: 0,
        duration: ANIMATION_DURATION
      }).start(this.props.onDelete)
      this.isDeleting = true
    }
  }

  render() {
    const {
      name,
    } = this.props

    const height = this.inAndOut.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 50],
      extrapolate: 'clamp'
    })
    const backgroundColor = this.state.dragging ? '#a1a1a1' : '#d3d3d3'

    const deleteViewAnimatedStyle = {
      transform: [
        {translateX: this.pan.x}
      ],
    }
    const opacity = this.inAndOut.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    })

    return (
      <Animated.View style={{ height, opacity }}>
        <View
          {...this.panResponder.panHandlers}
          style={[styles.contactWrapper, { backgroundColor }]}>
          <Text>{name}</Text>
        </View>
        <Animated.View style={[deleteViewAnimatedStyle, styles.deleteView]}/>
      </Animated.View>
      
    )
  }
}
export default class App extends Component {
  state = {
    contacts: CONTACTS,
    deletedContacts: [],
  }

  hasRenderedOnce = {}
  timeouts = {}

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

  handleListItemMount = (contactId) => {
    this.hasRenderedOnce[contactId] = true
  }

  renderItem = ({ item }) => {
    return (
      <ListItem
        id={item.key}
        name={item.name}
        onDelete={() => this.handleDelete(item.key)}
        shouldAnimateOnMount={this.hasRenderedOnce[item.key]}
        onMount={() => this.handleListItemMount(item.key)}
      />
    )
  }

  renderSeparator = () => {
    return (
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: "#000",
        }}
      />
    );
  }

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

  render() {
    return (
      <View style={styles.container}>
        <FlatList
          style={{backgroundColor: '#c3c3c3', flex: 1}}
          data={this.state.contacts.filter(contact => !this.state.deletedContacts[contact.key])}
          renderItem={this.renderItem}
          ItemSeparatorComponent={this.renderSeparator}
          ListFooterComponent={this.renderSeparator}
          scrollEnabled={false}
        />

        {Object.keys(this.state.deletedContacts).filter(x => this.state.deletedContacts[x]).map(deletedContact => (
          <Button
            key={deletedContact}
            title={`Restore ${deletedContact}`}
            onPress={() => this.restoreContact(deletedContact)}
          />
        ))}
      </View>
    );
  }
}

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
  }
});
